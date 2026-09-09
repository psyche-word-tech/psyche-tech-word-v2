import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, ActivityIndicator, TextInput, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { getApiBaseUrl } from '@/utils/apiConfig';

interface GradingResult {
  transcription?: string;
  total_score: number;
  max_score: number;
  scores: {
    content: number;
    language: number;
    structure: number;
    handwriting: number;
  };
  errors: Array<{
    type: string;
    errorType: 'missing' | 'wrong' | 'extra' | 'incomplete';
    original: string;
    correction: string;
    explanation: string;
  }>;
  comments: string;
  strengths: string[];
  improvements: string[];
}

export default function EssayGradingScreen() {
  const router = useSafeRouter();
  const { user } = useAuth();
  const MAX_PAGES = 3; // 一篇作文最多允许上传 3 页（语文多页）
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [referenceAnswer, setReferenceAnswer] = useState('');
  const [subject, setSubject] = useState<'english' | 'chinese'>('english');
  const [maxScore, setMaxScore] = useState('15');
  const [loading, setLoading] = useState(false);
  const [gradingResult, setGradingResult] = useState<GradingResult | null>(null);
  const [markedImages, setMarkedImages] = useState<string[]>([]);

  const switchSubject = (s: 'english' | 'chinese') => {
    setSubject(s);
    // 切换科目时给一个合理的默认满分，用户可按需修改
    setMaxScore(s === 'chinese' ? '40' : '15');
  };

  const maxAllowedPages = subject === 'chinese' ? MAX_PAGES : 1;
  const canAddMore = selectedImages.length < maxAllowedPages;

  const appendImages = (newUris: string[]) => {
    if (!newUris.length) return;
    const remaining = maxAllowedPages - selectedImages.length;
    const toAdd = newUris.slice(0, remaining);
    if (!toAdd.length) return;
    setSelectedImages((prev) => [...prev, ...toAdd].slice(0, maxAllowedPages));
    setGradingResult(null);
    setMarkedImages([]);
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    setGradingResult(null);
    setMarkedImages([]);
  };

  const pickImage = async () => {
    if (selectedImages.length >= maxAllowedPages) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
      base64: true,
      // 语文最多 3 页，可一次多选多张；英语仅 1 张
      selectionLimit: maxAllowedPages - selectedImages.length,
      allowsMultipleSelection: subject === 'chinese',
    });

    if (!result.canceled && result.assets.length) {
      appendImages(result.assets.map((a) => a.uri));
    }
  };

  const takePhoto = async () => {
    if (selectedImages.length >= maxAllowedPages) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('需要相机权限', '请在设置中允许访问相机');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      appendImages([result.assets[0].uri]);
    }
  };

  const handleGrade = async () => {
    if (!selectedImages.length) {
      Alert.alert('提示', '请先选择作文图片');
      return;
    }

    setLoading(true);
    try {
      // 逐张读取 base64（支持多页）
      const images: string[] = [];
      for (const uri of selectedImages) {
        const imageResponse = await fetch(uri);
        const imageBlob = await imageResponse.blob();
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(imageBlob);
        });
        images.push(base64);
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (user?.token) {
        headers['Authorization'] = `Bearer ${user.token}`;
      }

      const response = await fetch(`${getApiBaseUrl()}/api/v1/essay-grading/grade`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          images,
          reference_answer: referenceAnswer,
          max_score: parseInt(maxScore, 10) || 15,
          subject,
        }),
        signal: AbortSignal.timeout(180000), // 180 秒超时（千问 API 需要 50-60 秒）
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (data.success) {
        setGradingResult(data.data.grading);
        setMarkedImages(data.data.marked_images || (data.data.marked_image ? [data.data.marked_image] : []));
      } else {
        const errorMsg = data.error || '未知错误';
        if (Platform.OS === 'web') {
          alert('批改失败：' + errorMsg);
        } else {
          Alert.alert('批改失败', errorMsg);
        }
      }
    } catch (error: any) {
      console.error('批改失败:', error);
      const errorMsg = error.message || '网络错误';
      if (Platform.OS === 'web') {
        alert('批改失败：' + errorMsg);
      } else {
        Alert.alert('批改失败', errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const getErrorTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      grammar: '#FF0000',
      spelling: '#FF6600',
      punctuation: '#9900FF',
      word_choice: '#0066FF',
      sentence_structure: '#009900',
    };
    return colors[type] || '#666666';
  };

  const getErrorTypeName = (type: string) => {
    const names: Record<string, string> = {
      grammar: '语法',
      spelling: '拼写',
      punctuation: '标点',
      word_choice: '用词',
      sentence_structure: '句式',
    };
    return names[type] || type;
  };

  // 渲染带错误标注的原文
  const renderTranscriptionWithErrors = (transcription: string, errors: NonNullable<typeof gradingResult>['errors']) => {
    if (!transcription) return null;

    // 按段落分割
    const paragraphs = transcription.split('\n').filter(p => p.trim());
    
    return paragraphs.map((paragraph, pIdx) => {
      // 查找该段落中的错误
      const paragraphErrors = errors.filter(error => {
        if (!error.original) return false;
        return paragraph.includes(error.original);
      });
      
      if (paragraphErrors.length === 0) {
        // 没有错误，直接显示段落
        return (
          <View key={pIdx} style={styles.paragraphContainer}>
            <Text style={styles.paragraphText}>{paragraph}</Text>
          </View>
        );
      }
      
      // 有错误，需要分段显示
      let remainingText = paragraph;
      const segments: Array<{ text: string; isError: boolean; error?: typeof errors[0] }> = [];
      
      // 按在段落中的位置排序错误
      const sortedErrors = [...paragraphErrors].sort((a, b) => {
        const idxA = remainingText.indexOf(a.original);
        const idxB = remainingText.indexOf(b.original);
        return idxA - idxB;
      });
      
      for (const error of sortedErrors) {
        const errorText = error.original;
        const idx = remainingText.indexOf(errorText);
        
        if (idx !== -1) {
          // 添加错误前的文本
          if (idx > 0) {
            segments.push({ text: remainingText.substring(0, idx), isError: false });
          }
          
          // 添加错误文本
          segments.push({ text: errorText, isError: true, error });
          
          // 更新剩余文本
          remainingText = remainingText.substring(idx + errorText.length);
        }
      }
      
      // 添加剩余文本
      if (remainingText.length > 0) {
        segments.push({ text: remainingText, isError: false });
      }
      
      return (
        <View key={pIdx} style={styles.paragraphContainer}>
          <Text style={styles.paragraphText}>
            {segments.map((segment, sIdx) => {
              if (segment.isError && segment.error) {
                const error = segment.error;
                if (error.errorType === 'missing') {
                  // 缺失错误：显示 [缺 xxx]
                  return (
                    <Text key={sIdx} style={styles.errorMissingText}>
                      [缺 {error.correction}]
                    </Text>
                  );
                } else if (error.errorType === 'wrong') {
                  // 错误用词：显示原文 → 修正
                  return (
                    <Text key={sIdx}>
                      <Text style={styles.errorWrongText}>{error.original}</Text>
                      <Text style={styles.correctionArrow}> → </Text>
                      <Text style={styles.correctionText}>{error.correction}</Text>
                    </Text>
                  );
                } else if (error.errorType === 'extra') {
                  // 多余内容：显示删除线
                  return (
                    <Text key={sIdx} style={styles.errorExtraText}>
                      {error.original}
                    </Text>
                  );
                } else if (error.errorType === 'incomplete') {
                  // 句子不完整
                  return (
                    <Text key={sIdx} style={styles.errorIncompleteText}>
                      [{error.explanation}]
                    </Text>
                  );
                } else {
                  // 默认显示为红色下划线
                  return (
                    <Text key={sIdx} style={styles.errorWrongText}>
                      {error.original}
                    </Text>
                  );
                }
              }
              return <Text key={sIdx}>{segment.text}</Text>;
            })}
          </Text>
        </View>
      );
    });
  };

  return (
    <Screen>
      <ScrollView style={styles.container}>
        {/* 顶部标题栏 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>作文批改</Text>
          <TouchableOpacity onPress={() => router.push('/batch-grading')} style={styles.batchButton}>
            <Ionicons name="layers-outline" size={24} color="#4CAF50" />
          </TouchableOpacity>
        </View>

        {/* 图片选择区域 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. 上传作文图片</Text>
          
          {selectedImages.length > 0 ? (
            <View style={styles.previewRow}>
              {selectedImages.map((uri, idx) => (
                <View key={idx} style={styles.thumbContainer}>
                  <Image source={{ uri }} style={styles.previewThumb} resizeMode="contain" />
                  {!loading && (
                    <TouchableOpacity style={styles.thumbRemove} onPress={() => removeImage(idx)}>
                      <Ionicons name="close-circle" size={20} color="#ff3b30" />
                    </TouchableOpacity>
                  )}
                  <Text style={styles.thumbLabel}>第{idx + 1}页</Text>
                </View>
              ))}
              {canAddMore && (
                <TouchableOpacity style={styles.addImageButton} onPress={takePhoto}>
                  <Ionicons name="camera-outline" size={26} color="#4CAF50" />
                  <Text style={styles.addImageText}>拍照添加</Text>
                </TouchableOpacity>
              )}
              {canAddMore && (
                <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
                  <Ionicons name="images-outline" size={26} color="#4CAF50" />
                  <Text style={styles.addImageText}>相册添加</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.imagePickerContainer}>
              <TouchableOpacity style={styles.imagePickerButton} onPress={takePhoto}>
                <Ionicons name="camera-outline" size={32} color="#666" />
                <Text style={styles.imagePickerText}>拍照</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.imagePickerButton} onPress={pickImage}>
                <Ionicons name="images-outline" size={32} color="#666" />
                <Text style={styles.imagePickerText}>从相册选择</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 批改设置 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. 批改设置</Text>

          {/* 科目选择 */}
          <Text style={styles.fieldLabel}>作文科目</Text>
          <View style={styles.subjectRow}>
            <TouchableOpacity
              style={[styles.subjectButton, subject === 'english' && styles.subjectButtonActive]}
              onPress={() => switchSubject('english')}
              disabled={loading}
            >
              <Text style={[styles.subjectButtonText, subject === 'english' && styles.subjectButtonTextActive]}>
                英语作文
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.subjectButton, subject === 'chinese' && styles.subjectButtonActive]}
              onPress={() => switchSubject('chinese')}
              disabled={loading}
            >
              <Text style={[styles.subjectButtonText, subject === 'chinese' && styles.subjectButtonTextActive]}>
                语文作文
              </Text>
            </TouchableOpacity>
          </View>

          {/* 满分分值 */}
          <Text style={styles.fieldLabel}>满分分值</Text>
          <TextInput
            style={styles.scoreInput}
            keyboardType="number-pad"
            placeholder="请输入满分分值"
            value={maxScore}
            onChangeText={setMaxScore}
            editable={!loading}
          />

          <Text style={styles.fieldLabel}>参考答案（可选）</Text>
          <TextInput
            style={styles.textInput}
            multiline
            numberOfLines={6}
            placeholder="请输入参考答案，千问模型将对照参考答案进行批改..."
            value={referenceAnswer}
            onChangeText={setReferenceAnswer}
            textAlignVertical="top"
            editable={!loading}
          />
        </View>

        {/* 批改按钮 */}
        <TouchableOpacity
          style={[styles.gradeButton, (selectedImages.length === 0 || loading) && styles.gradeButtonDisabled]}
          onPress={handleGrade}
          disabled={selectedImages.length === 0 || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.gradeButtonText}>开始批改</Text>
          )}
        </TouchableOpacity>

        {/* 批改结果 */}
        {gradingResult && (
          <View style={styles.resultSection}>
            <Text style={styles.sectionTitle}>3. 批改结果</Text>

            {/* 作文原文（富文本显示，红色标注错误） */}
            {gradingResult.transcription && (
              <View style={styles.transcriptionContainer}>
                <Text style={styles.subSectionTitle}>原文转录（红色 = 错误处）</Text>
                <View style={styles.transcriptionTextContainer}>
                  {renderTranscriptionWithErrors(gradingResult.transcription, gradingResult.errors)}
                </View>
              </View>
            )}

            {/* 分数卡片 */}
            <View style={styles.scoreCard}>
              <View style={styles.totalScoreContainer}>
                <Text style={styles.totalScoreLabel}>总分</Text>
                <Text style={styles.totalScoreValue}>
                  {gradingResult.total_score}
                  <Text style={styles.totalScoreMax}>/{gradingResult.max_score}</Text>
                </Text>
              </View>
              
              <View style={styles.scoreDetails}>
                <View style={styles.scoreItem}>
                  <Text style={styles.scoreItemLabel}>内容</Text>
                  <Text style={styles.scoreItemValue}>{gradingResult.scores.content}</Text>
                </View>
                <View style={styles.scoreItem}>
                  <Text style={styles.scoreItemLabel}>语言</Text>
                  <Text style={styles.scoreItemValue}>{gradingResult.scores.language}</Text>
                </View>
                <View style={styles.scoreItem}>
                  <Text style={styles.scoreItemLabel}>结构</Text>
                  <Text style={styles.scoreItemValue}>{gradingResult.scores.structure}</Text>
                </View>
                <View style={styles.scoreItem}>
                  <Text style={styles.scoreItemLabel}>书写</Text>
                  <Text style={styles.scoreItemValue}>{gradingResult.scores.handwriting}</Text>
                </View>
              </View>
            </View>

            {/* 标注图片（多页左右滑） */}
            {markedImages.length > 0 && (
              <View style={styles.markedImageContainer}>
                <Text style={styles.subSectionTitle}>
                  标注图 {markedImages.length > 1 ? `（共${markedImages.length}页，左右滑动）` : ''}
                </Text>
                {markedImages.length === 1 ? (
                  <Image
                    source={{ uri: markedImages[0] }}
                    style={styles.markedImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.carouselContainer}>
                    <ScrollView
                      horizontal
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      style={styles.carousel}
                    >
                      {markedImages.map((img, idx) => (
                        <View key={idx} style={styles.carouselPage}>
                          <Image source={{ uri: img }} style={styles.markedImage} resizeMode="contain" />
                        </View>
                      ))}
                    </ScrollView>
                    <View style={styles.pageDots}>
                      {markedImages.map((_, idx) => (
                        <View key={idx} style={styles.pageDot} />
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* 错误列表 */}
            {gradingResult.errors.length > 0 && (
              <View style={styles.errorsContainer}>
                <Text style={styles.subSectionTitle}>错误详情 ({gradingResult.errors.length}处)</Text>
                {gradingResult.errors.map((error, index) => (
                  <View key={index} style={styles.errorItem}>
                    <View style={styles.errorHeader}>
                      <View style={[styles.errorTypeBadge, { backgroundColor: getErrorTypeColor(error.type) }]}>
                        <Text style={styles.errorTypeText}>{getErrorTypeName(error.type)}</Text>
                      </View>
                    </View>
                    <View style={styles.errorContent}>
                      <Text style={styles.errorOriginal}> {error.original}</Text>
                      <Text style={styles.errorCorrection}>✅ {error.correction}</Text>
                      <Text style={styles.errorExplanation}>💡 {error.explanation}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* 总体评语 */}
            <View style={styles.commentsContainer}>
              <Text style={styles.subSectionTitle}>总体评语</Text>
              <Text style={styles.commentsText}>{gradingResult.comments}</Text>
            </View>

            {/* 优点 */}
            {gradingResult.strengths.length > 0 && (
              <View style={styles.strengthsContainer}>
                <Text style={styles.subSectionTitle}>✨ 优点</Text>
                {gradingResult.strengths.map((strength, index) => (
                  <Text key={index} style={styles.strengthItem}>• {strength}</Text>
                ))}
              </View>
            )}

            {/* 改进建议 */}
            {gradingResult.improvements.length > 0 && (
              <View style={styles.improvementsContainer}>
                <Text style={styles.subSectionTitle}> 改进建议</Text>
                {gradingResult.improvements.map((improvement, index) => (
                  <Text key={index} style={styles.improvementItem}>• {improvement}</Text>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  batchButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  previewRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  thumbContainer: {
    alignItems: 'center',
    marginBottom: 4,
  },
  thumbRemove: {
    position: 'absolute',
    top: -8,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  thumbRemoveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  addImageButton: {
    width: 84,
    height: 84,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#B0B0B0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
  },
  addImageText: {
    fontSize: 24,
    color: '#999',
  },
  previewThumb: {
    width: 84,
    height: 84,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  thumbLabel: {
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
    marginTop: 2,
    width: 84,
  },
  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#E53935',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  imagePickerContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  imagePickerButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  imagePickerText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  imageContainer: {
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
  },
  changeImageButton: {
    marginTop: 12,
    padding: 8,
  },
  changeImageText: {
    color: '#3B82F6',
    fontSize: 14,
  },
  fieldLabel: {
    fontSize: 13,
    color: '#666',
    marginTop: 8,
    marginBottom: 6,
  },
  subjectRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  subjectButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
  },
  subjectButtonActive: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  subjectButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  subjectButtonTextActive: {
    color: '#3B82F6',
  },
  scoreInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#FAFAFA',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 120,
    backgroundColor: '#FAFAFA',
  },
  gradeButton: {
    margin: 16,
    padding: 16,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    alignItems: 'center',
  },
  gradeButtonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  gradeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultSection: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 12,
  },
  transcriptionContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  transcriptionTextContainer: {
    marginTop: 8,
  },
  paragraphContainer: {
    marginBottom: 12,
  },
  paragraphText: {
    fontSize: 16,
    lineHeight: 28,
    color: '#333',
    fontStyle: 'italic',
  },
  errorWrongText: {
    color: '#DC2626',
    textDecorationLine: 'underline',
    textDecorationColor: '#DC2626',
    fontWeight: '600',
  },
  errorMissingText: {
    color: '#DC2626',
    fontWeight: '600',
    fontStyle: 'italic',
  },
  errorExtraText: {
    color: '#DC2626',
    textDecorationLine: 'line-through',
    textDecorationColor: '#DC2626',
  },
  errorIncompleteText: {
    color: '#DC2626',
    fontWeight: '600',
    fontStyle: 'italic',
  },
  correctionArrow: {
    color: '#16A34A',
    fontWeight: '600',
  },
  correctionText: {
    color: '#16A34A',
    fontWeight: '600',
  },
  scoreCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  totalScoreContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  totalScoreLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  totalScoreValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#3B82F6',
  },
  totalScoreMax: {
    fontSize: 18,
    color: '#999',
  },
  scoreDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  scoreItem: {
    alignItems: 'center',
  },
  scoreItemLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  scoreItemValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  markedImageContainer: {
    marginBottom: 16,
  },
  carouselContainer: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  carousel: {
    flexGrow: 0,
  },
  carouselPage: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  carouselImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  pageDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  pageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D0D0D0',
    marginHorizontal: 4,
  },
  pageDotActive: {
    backgroundColor: '#4F46E5',
  },
  markedImage: {
    width: '100%',
    height: 400,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  errorsContainer: {
    marginBottom: 16,
  },
  errorItem: {
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  errorHeader: {
    marginBottom: 8,
  },
  errorTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  errorTypeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  errorContent: {
    gap: 4,
  },
  errorOriginal: {
    fontSize: 14,
    color: '#FF0000',
  },
  errorCorrection: {
    fontSize: 14,
    color: '#009900',
  },
  errorExplanation: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  commentsContainer: {
    marginBottom: 16,
  },
  commentsText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  strengthsContainer: {
    marginBottom: 16,
  },
  strengthItem: {
    fontSize: 14,
    color: '#009900',
    marginBottom: 4,
  },
  improvementsContainer: {
    marginBottom: 16,
  },
  improvementItem: {
    fontSize: 14,
    color: '#FF6600',
    marginBottom: 4,
  },
});
