import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Alert, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { getApiBaseUrl } from '@/utils/apiConfig';

interface GradingResult {
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
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [referenceAnswer, setReferenceAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [gradingResult, setGradingResult] = useState<GradingResult | null>(null);
  const [markedImage, setMarkedImage] = useState<string | null>(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      setGradingResult(null);
      setMarkedImage(null);
    }
  };

  const takePhoto = async () => {
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
      setSelectedImage(result.assets[0].uri);
      setGradingResult(null);
      setMarkedImage(null);
    }
  };

  const handleGrade = async () => {
    if (!selectedImage) {
      Alert.alert('提示', '请先选择作文图片');
      return;
    }

    setLoading(true);
    try {
      // 读取图片 base64
      const imageResponse = await fetch(selectedImage);
      const imageBlob = await imageResponse.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(imageBlob);
      });

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
          image: base64,
          reference_answer: referenceAnswer,
          max_score: 25,
        }),
        signal: AbortSignal.timeout(60000), // 60 秒超时
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (data.success) {
        setGradingResult(data.data.grading);
        setMarkedImage(data.data.marked_image);
      } else {
        Alert.alert('批改失败', data.error || '未知错误');
      }
    } catch (error: any) {
      console.error('批改失败:', error);
      Alert.alert('批改失败', error.message || '网络错误');
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
          
          {selectedImage ? (
            <View style={styles.imageContainer}>
              <Image source={{ uri: selectedImage }} style={styles.previewImage} resizeMode="contain" />
              <TouchableOpacity style={styles.changeImageButton} onPress={pickImage}>
                <Text style={styles.changeImageText}>更换图片</Text>
              </TouchableOpacity>
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

        {/* 参考答案输入 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. 输入参考答案</Text>
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
          style={[styles.gradeButton, (!selectedImage || loading) && styles.gradeButtonDisabled]}
          onPress={handleGrade}
          disabled={!selectedImage || loading}
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

            {/* 标注图片 */}
            {markedImage && (
              <View style={styles.markedImageContainer}>
                <Text style={styles.subSectionTitle}>标注图</Text>
                <Image source={{ uri: markedImage }} style={styles.markedImage} resizeMode="contain" />
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
