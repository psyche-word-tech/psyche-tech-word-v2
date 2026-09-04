import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Alert, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { getApiBaseUrl } from '@/utils/apiConfig';

interface ImageItem {
  uri: string;
  base64?: string;
}

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

interface BatchResult {
  imageUri: string;
  result: GradingResult | null;
  markedImage: string | null;
  loading: boolean;
  error?: string;
}

export default function BatchGradingScreen() {
  const router = useSafeRouter();
  const { user } = useAuth();
  const [images, setImages] = useState<ImageItem[]>([]);
  const [referenceAnswer, setReferenceAnswer] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalImages, setTotalImages] = useState(0);

  const pickMultipleImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      const newImages: ImageItem[] = result.assets.map(asset => ({
        uri: asset.uri,
        base64: asset.base64,
      }));
      setImages(prev => [...prev, ...newImages]);
      setResults([]);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleBatchGrade = async () => {
    if (images.length === 0) {
      Alert.alert('提示', '请先选择作文图片');
      return;
    }

    setBatchLoading(true);
    setTotalImages(images.length);
    setCurrentIndex(0);

    const batchResults: BatchResult[] = images.map(img => ({
      imageUri: img.uri,
      result: null,
      markedImage: null,
      loading: false,
    }));
    setResults(batchResults);

    for (let i = 0; i < images.length; i++) {
      setCurrentIndex(i + 1);
      
      // 更新当前图片为加载中
      setResults(prev => prev.map((r, idx) => 
        idx === i ? { ...r, loading: true } : r
      ));

      try {
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
            image: images[i].base64 || '',
            reference_answer: referenceAnswer,
            max_score: 15,
          }),
        });

        const data = await response.json();

        if (data.success) {
          setResults(prev => prev.map((r, idx) => 
            idx === i ? { 
              ...r, 
              loading: false,
              result: data.data.grading,
              markedImage: data.data.marked_image,
            } : r
          ));
        } else {
          setResults(prev => prev.map((r, idx) => 
            idx === i ? { 
              ...r, 
              loading: false,
              error: data.error || '批改失败',
            } : r
          ));
        }
      } catch (error: any) {
        setResults(prev => prev.map((r, idx) => 
          idx === i ? { 
            ...r, 
            loading: false,
            error: error.message || '网络错误',
          } : r
        ));
      }
    }

    setBatchLoading(false);
    Alert.alert('批改完成', `共批改 ${images.length} 篇作文`);
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
          <Text style={styles.headerTitle}>批量批改</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* 图片选择区域 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>1. 选择作文图片</Text>
            <Text style={styles.imageCount}>{images.length} 张</Text>
          </View>
          
          {images.length > 0 ? (
            <View style={styles.imageGrid}>
              {images.map((img, index) => (
                <View key={index} style={styles.imageGridItem}>
                  <Image source={{ uri: img.uri }} style={styles.gridImage} resizeMode="cover" />
                  <TouchableOpacity 
                    style={styles.removeImageButton}
                    onPress={() => removeImage(index)}
                  >
                    <Ionicons name="close-circle" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.addImageButton} onPress={pickMultipleImages}>
                <Ionicons name="add" size={32} color="#666" />
                <Text style={styles.addImageText}>继续添加</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.pickImageButton} onPress={pickMultipleImages}>
              <Ionicons name="images-outline" size={40} color="#666" />
              <Text style={styles.pickImageText}>选择多张图片</Text>
              <Text style={styles.pickImageSubtext}>支持一次选择多张作文图片</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 参考答案输入 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. 输入参考答案（可选）</Text>
          <TextInput
            style={styles.textInput}
            multiline
            numberOfLines={4}
            placeholder="请输入参考答案，千问模型将对照参考答案进行批改..."
            value={referenceAnswer}
            onChangeText={setReferenceAnswer}
            textAlignVertical="top"
            editable={!batchLoading}
          />
        </View>

        {/* 批量批改按钮 */}
        <TouchableOpacity
          style={[styles.gradeButton, (images.length === 0 || batchLoading) && styles.gradeButtonDisabled]}
          onPress={handleBatchGrade}
          disabled={images.length === 0 || batchLoading}
        >
          {batchLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.loadingText}>批改中 {currentIndex}/{totalImages}</Text>
            </View>
          ) : (
            <Text style={styles.gradeButtonText}>开始批量批改 ({images.length} 张)</Text>
          )}
        </TouchableOpacity>

        {/* 批改结果列表 */}
        {results.length > 0 && (
          <View style={styles.resultSection}>
            <Text style={styles.sectionTitle}>3. 批改结果</Text>

            {results.map((item, index) => (
              <View key={index} style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultTitle}>作文 {index + 1}</Text>
                  {item.loading && <ActivityIndicator size="small" color="#666" />}
                  {item.error && <Text style={styles.errorText}>{item.error}</Text>}
                </View>

                {item.result && (
                  <>
                    {/* 分数 */}
                    <View style={styles.scoreRow}>
                      <Text style={styles.scoreLabel}>总分</Text>
                      <Text style={styles.scoreValue}>
                        {item.result.total_score}/{item.result.max_score}
                      </Text>
                    </View>

                    <View style={styles.scoreDetails}>
                      <View style={styles.scoreItem}>
                        <Text style={styles.scoreItemLabel}>内容</Text>
                        <Text style={styles.scoreItemValue}>{item.result.scores.content}</Text>
                      </View>
                      <View style={styles.scoreItem}>
                        <Text style={styles.scoreItemLabel}>语言</Text>
                        <Text style={styles.scoreItemValue}>{item.result.scores.language}</Text>
                      </View>
                      <View style={styles.scoreItem}>
                        <Text style={styles.scoreItemLabel}>结构</Text>
                        <Text style={styles.scoreItemValue}>{item.result.scores.structure}</Text>
                      </View>
                      <View style={styles.scoreItem}>
                        <Text style={styles.scoreItemLabel}>书写</Text>
                        <Text style={styles.scoreItemValue}>{item.result.scores.handwriting}</Text>
                      </View>
                    </View>

                    {/* 标注图 */}
                    {item.markedImage && (
                      <View style={styles.markedImageContainer}>
                        <Text style={styles.markedImageTitle}>标注图</Text>
                        <Image 
                          source={{ uri: item.markedImage }} 
                          style={styles.markedImage} 
                          resizeMode="contain" 
                        />
                      </View>
                    )}

                    {/* 评语 */}
                    {item.result.comments && (
                      <View style={styles.commentsContainer}>
                        <Text style={styles.commentsTitle}>评语</Text>
                        <Text style={styles.commentsText}>{item.result.comments}</Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  imageCount: {
    fontSize: 14,
    color: '#666',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  imageGridItem: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  pickImageButton: {
    alignItems: 'center',
    paddingVertical: 32,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 8,
  },
  pickImageText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  pickImageSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    backgroundColor: '#fafafa',
  },
  gradeButton: {
    backgroundColor: '#4CAF50',
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  gradeButtonDisabled: {
    backgroundColor: '#ccc',
  },
  gradeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  resultCard: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  errorText: {
    fontSize: 12,
    color: '#f44336',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 8,
  },
  scoreLabel: {
    fontSize: 14,
    color: '#666',
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  scoreDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  scoreItem: {
    alignItems: 'center',
  },
  scoreItemLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  scoreItemValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  markedImageContainer: {
    marginTop: 12,
  },
  markedImageTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  markedImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  commentsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  commentsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  commentsText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});
