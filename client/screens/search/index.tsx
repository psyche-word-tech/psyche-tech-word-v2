import { View, Text, TextInput, TouchableOpacity, Image, ScrollView, ActivityIndicator, Platform, Modal } from 'react-native';
import { Ionicons, FontAwesome6 } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useState, useEffect } from 'react';
import { MathText } from '@/components/MathText';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

interface QuestionResult {
  subject?: string;
  question?: string;
  analysis?: string;
  solution?: string;
  answer?: string;
  tips?: string;
  knowledge_points?: string;
  core_competency?: string;
  difficulty?: string;
}

interface SolveResult {
  questions?: QuestionResult[];
  error?: string;
}

export default function SearchScreen() {
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ imageUri?: string }>();
  const [query, setQuery] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(params.imageUri || null);
  const [result, setResult] = useState<SolveResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  useEffect(() => {
    if (imageUri !== null) {
      solveProblem(imageUri);
    }
  }, [imageUri]);

  const solveProblem = async (uri: string) => {
    setLoading(true);
    setResult(null);

    try {
      let blob: Blob;
      
      if (uri.startsWith('data:')) {
        // Data URL (base64) - convert directly to blob without fetch
        try {
          const arr = uri.split(',');
          const mimeMatch = arr[0].match(/:(.*?);/);
          const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
          const base64 = arr[1];
          
          if (!base64) {
            throw new Error('Invalid data URL: no base64 data');
          }
          
          const bstr = atob(base64);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          blob = new Blob([u8arr], { type: mime });
          console.log('[Search] Data URL converted to blob, size:', blob.size);
        } catch (e) {
          console.error('[Search] Failed to convert data URL:', e);
          // Fallback: try fetch
          const response = await fetch(uri);
          blob = await response.blob();
        }
      } else {
        // Regular URL - fetch it
        const response = await fetch(uri);
        blob = await response.blob();
      }

      console.log('[Search] Image blob size:', blob.size, 'type:', blob.type);

      // Create FormData - use browser native FormData on web
      const formData = new FormData();
      
      if (Platform.OS === 'web') {
        // Web: append blob directly
        formData.append('image', blob, 'problem.jpg');
      } else {
        // Native: use React Native FormData format
        formData.append('image', {
          uri: uri,
          name: 'problem.jpg',
          type: blob.type || 'image/jpeg',
        } as any);
      }

      console.log('[Search] Sending request to /api/v1/solve-problem');

      const res = await fetch('/api/v1/solve-problem', {
        method: 'POST',
        body: formData,
      });

      console.log('[Search] Response status:', res.status);

      if (!res.ok) {
        const errorText = await res.text();
        console.error('[Search] API error:', errorText);
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      console.log('[Search] Response data:', data);
      setResult(data);
    } catch (err) {
      console.error('Solve problem error:', err);
      setResult({ error: '解析失败，请重试' });
    } finally {
      setLoading(false);
    }
  };

  const handleFavorite = async (question: QuestionResult) => {
    setFavoriteLoading(true);
    try {
      const res = await fetch('/api/v1/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_text: question.question || '',
          subject: question.subject,
          answer: question.answer,
          analysis: question.analysis,
          solution: question.solution,
          tips: question.tips,
          image_url: imageUri,
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert('收藏成功');
      } else {
        alert(data.message || '收藏失败');
      }
    } catch (err) {
      console.error('Favorite error:', err);
      alert('收藏失败，请重试');
    } finally {
      setFavoriteLoading(false);
    }
  };

  const handleReselect = () => {
    setShowImagePicker(true);
  };

  const handleTakePhoto = async () => {
    setShowImagePicker(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('需要相机权限才能拍照');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setImageUri(uri);
        setResult(null);
        setLoading(true);
        await solveProblem(uri);
      }
    } catch (err) {
      console.error('Camera error:', err);
      alert('拍照失败，请重试');
    }
  };

  const handlePickFromLibrary = async () => {
    setShowImagePicker(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('需要相册权限才能选择图片');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setImageUri(uri);
        setResult(null);
        setLoading(true);
        await solveProblem(uri);
      }
    } catch (err) {
      console.error('Image picker error:', err);
      alert('选择图片失败，请重试');
    }
  };

  const handleUploadFile = async () => {
    setShowImagePicker(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.wps-office.doc', 'application/vnd.wps-office.docx'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      console.log('[Search] Selected file:', file.name, file.uri);
      alert(`已选择文件：${file.name}\n\n注意：当前版本仅支持图片搜题，文档解析功能开发中。`);
    } catch (err) {
      console.error('Document picker error:', err);
      alert('选择文件失败，请重试');
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <TextInput
            style={styles.searchInput}
            placeholder="搜索单词..."
            placeholderTextColor="#999"
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={styles.content}>
          {/* Show selected image if available */}
          {imageUri.length > 0 && (
            <View style={styles.imageSection}>
              <Text style={styles.sectionTitle}>题目图片</Text>
              <Image source={{ uri: imageUri }} style={styles.selectedImage} resizeMode="contain" />
              <TouchableOpacity style={styles.retakeButton} onPress={handleReselect}>
                <Ionicons name="refresh" size={18} color="#666" />
                <Text style={styles.retakeText}>重新选择</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Image Picker Modal */}
          <Modal
            visible={showImagePicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowImagePicker(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowImagePicker(false)}
            >
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>选择图片来源</Text>
                <TouchableOpacity style={styles.modalButton} onPress={handleTakePhoto}>
                  <Ionicons name="camera" size={24} color="#333" />
                  <Text style={styles.modalButtonText}>拍照</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalButton} onPress={handlePickFromLibrary}>
                  <Ionicons name="images" size={24} color="#333" />
                  <Text style={styles.modalButtonText}>从相册选择</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalButton} onPress={handleUploadFile}>
                  <Ionicons name="document-text" size={24} color="#333" />
                  <Text style={styles.modalButtonText}>上传文件</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setShowImagePicker(false)}
                >
                  <Text style={styles.modalCancelText}>取消</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* Loading */}
          {loading && (
            <View style={styles.loadingSection}>
              <ActivityIndicator size="large" color="#4A90E2" />
              <Text style={styles.loadingText}>正在解析题目...</Text>
            </View>
          )}

          {/* Result */}
          {result && !loading && (
            <View style={styles.resultSection}>
              {result.error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={24} color="#FF6B6B" />
                  <Text style={styles.errorText}>{result.error}</Text>
                </View>
              ) : (
                <>
                  {result.questions && result.questions.map((q, index) => (
                    <View key={index} style={styles.questionCard}>
                      {result.questions && result.questions.length > 1 && (
                        <View style={styles.questionNumber}>
                          <Text style={styles.questionNumberText}>第 {index + 1} 题</Text>
                        </View>
                      )}

                      {q.from_cache && (
                        <View style={styles.cacheBadge}>
                          <Text style={styles.cacheBadgeText}> 来自缓存</Text>
                        </View>
                      )}

                      {q.subject && (
                        <View style={styles.subjectTag}>
                          <Text style={styles.subjectText}>{q.subject}</Text>
                        </View>
                      )}

                      {q.question && (
                        <View style={styles.resultBlock}>
                          <Text style={styles.blockTitle}>题目</Text>
                          <MathText text={q.question} style={styles.blockContent} />
                        </View>
                      )}

                      {q.answer && (
                        <View style={styles.answerBlock}>
                          <Text style={styles.answerTitle}>答案</Text>
                          <MathText text={q.answer} style={styles.answerContent} />
                        </View>
                      )}

                      {q.analysis && (
                        <View style={styles.resultBlock}>
                          <Text style={styles.blockTitle}>解析</Text>
                          <MathText text={q.analysis} style={styles.blockContent} />
                        </View>
                      )}

                      {q.solution && (
                        <View style={styles.resultBlock}>
                          <Text style={styles.blockTitle}>解答</Text>
                          <MathText text={q.solution} style={styles.blockContent} />
                        </View>
                      )}

                      {q.tips && (
                        <View style={styles.tipsBlock}>
                          <Text style={styles.tipsTitle}>💡 解题技巧</Text>
                          <MathText text={q.tips} style={styles.tipsContent} />
                        </View>
                      )}

                      {/* 收藏按钮 */}
                      <TouchableOpacity
                        style={styles.favoriteButton}
                        onPress={() => handleFavorite(q)}
                        disabled={favoriteLoading}
                      >
                        <Ionicons
                          name={q.isFavorite ? 'heart' : 'heart-outline'}
                          size={20}
                          color={q.isFavorite ? '#EF4444' : '#666'}
                        />
                        <Text style={[
                          styles.favoriteText,
                          q.isFavorite && styles.favoriteTextActive
                        ]}>
                          {q.isFavorite ? '已收藏' : '收藏'}
                        </Text>
                      </TouchableOpacity>

                      {/* 双向细目表 */}
                      {(q.knowledge_points || q.core_competency || q.difficulty) && (
                        <View style={styles.specTable}>
                          <View style={styles.specTableHeader}>
                            <Ionicons name="analytics-outline" size={16} color="#6366F1" />
                            <Text style={styles.specTableTitle}>双向细目表</Text>
                          </View>
                          <View style={styles.specTableBody}>
                            {q.knowledge_points && (
                              <View style={styles.specRow}>
                                <Text style={styles.specLabel}>考查知识点</Text>
                                <Text style={styles.specValue}>{q.knowledge_points}</Text>
                              </View>
                            )}
                            {q.core_competency && (
                              <View style={styles.specRow}>
                                <Text style={styles.specLabel}>学科核心素养</Text>
                                <Text style={styles.specValue}>{q.core_competency}</Text>
                              </View>
                            )}
                            {q.difficulty && (
                              <View style={styles.specRow}>
                                <Text style={styles.specLabel}>难度等级</Text>
                                <View style={styles.difficultyBadge}>
                                  <Text style={[
                                    styles.difficultyText,
                                    q.difficulty === '简单' && styles.difficultyEasy,
                                    q.difficulty === '中等' && styles.difficultyMedium,
                                    q.difficulty === '困难' && styles.difficultyHard,
                                  ]}>
                                    {q.difficulty}
                                  </Text>
                                </View>
                              </View>
                            )}
                          </View>
                        </View>
                      )}
                    </View>
                  ))}
                </>
              )}
            </View>
          )}

          {/* Empty State */}
          {!imageUri && !loading && !result && (
            <View style={styles.resultsPlaceholder}>
              <Ionicons name="search-outline" size={48} color="#DDD" />
              <Text style={styles.hintText}>输入单词或拍照搜索</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#333',
  },
  content: {
    flex: 1,
  },
  imageSection: {
    padding: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sectionTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  selectedImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
  },
  retakeText: {
    fontSize: 14,
    color: '#666',
  },
  loadingSection: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
  },
  resultSection: {
    padding: 16,
  },
  questionCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  questionNumber: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  questionNumberText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  cacheBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  cacheBadgeText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  subjectTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  subjectText: {
    fontSize: 12,
    color: '#1976D2',
    fontWeight: '600',
  },
  resultBlock: {
    marginBottom: 20,
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  blockContent: {
    fontSize: 14,
    color: '#555',
    lineHeight: 18,
  },
  answerBlock: {
    backgroundColor: '#F1F8E9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  answerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#33691E',
    marginBottom: 8,
  },
  answerContent: {
    fontSize: 16,
    fontWeight: '600',
    color: '#33691E',
  },
  tipsBlock: {
    backgroundColor: '#FFF8E1',
    padding: 16,
    borderRadius: 8,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F57F17',
    marginBottom: 8,
  },
  tipsContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#C62828',
  },
  resultsPlaceholder: {
    padding: 60,
    alignItems: 'center',
  },
  hintText: {
    marginTop: 16,
    fontSize: 14,
    color: '#999',
  },
  favoriteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    alignSelf: 'center',
    marginTop: 8,
  },
  favoriteText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  favoriteTextActive: {
    color: '#EF4444',
  },
  specTable: {
    marginTop: 16,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  specTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  specTableTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4338CA',
  },
  specTableBody: {
    gap: 8,
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  specLabel: {
    fontSize: 12,
    color: '#6B7280',
    width: 80,
    fontWeight: '500',
  },
  specValue: {
    fontSize: 13,
    color: '#1F2937',
    flex: 1,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: '500',
  },
  difficultyEasy: {
    color: '#059669',
  },
  difficultyMedium: {
    color: '#D97706',
  },
  difficultyHard: {
    color: '#DC2626',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  modalButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  modalCancelButton: {
    alignItems: 'center',
    padding: 16,
    marginTop: 8,
  },
  modalCancelText: {
    fontSize: 16,
    color: '#999',
  },
};
