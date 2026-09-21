import { View, Text, TextInput, TouchableOpacity, Image, ScrollView, ActivityIndicator, Platform, Modal, useWindowDimensions } from 'react-native';
import { Ionicons, FontAwesome6 } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useState, useEffect } from 'react';
import { MathText } from '@/components/MathText';
import { MathView } from '@/components/MathView';
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

interface SearchFile {
  uri: string;
  name: string;
  type: string;
  isImage: boolean;
}

export default function SearchScreen() {
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ imageUri?: string }>();
  const [query, setQuery] = useState('');
  const [files, setFiles] = useState<SearchFile[]>(params.imageUri ? [{ uri: params.imageUri, name: '题目图片.jpg', type: 'image/jpeg', isImage: true }] : []);
  const [result, setResult] = useState<SolveResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailedMode, setDetailedMode] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [activePage, setActivePage] = useState(0);
  const { width: winWidth } = useWindowDimensions();

  useEffect(() => {
    // 模式切换时不自动重发（避免重复请求），交由用户切换文件或触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailedMode]);

  const solveProblem = async (uploads: SearchFile[]) => {
    setLoading(true);
    setResult(null);

    try {
      // Create FormData - use browser native FormData on web
      const formData = new FormData();

      for (const f of uploads) {
        if (Platform.OS === 'web') {
          let blob: Blob;
          if (f.uri.startsWith('data:')) {
            try {
              const arr = f.uri.split(',');
              const mimeMatch = arr[0].match(/:(.*?);/);
              const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
              const bstr = atob(arr[1]);
              const u8 = new Uint8Array(bstr.length);
              for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
              blob = new Blob([u8], { type: mime || f.type });
            } catch (e) {
              const response = await fetch(f.uri);
              blob = await response.blob();
            }
          } else {
            const response = await fetch(f.uri);
            blob = await response.blob();
          }
          formData.append('files', blob, f.name);
        } else {
          // Native: use React Native FormData format
          formData.append('files', {
            uri: f.uri,
            name: f.name,
            type: f.type || 'application/octet-stream',
          } as any);
        }
      }
      // mode: detail=详细解析(较慢)，默认 concise=精炼解答(快)
      formData.append('mode', detailedMode ? 'detail' : 'concise');

      console.log('[Search] Sending request to /api/v1/solve-problem, files:', uploads.length);

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

  const renderQuestionCard = (q: QuestionResult, index: number) => (
    <View key={index} style={styles.questionCard}>
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

      {(q.question || files.length > 0) && (
        <View style={styles.resultBlock}>
          <Text style={styles.blockTitle}>题目</Text>
          {q.question ? (
            <MathText text={q.question} style={styles.blockContent} />
          ) : files.length > 0 ? (
            <View style={styles.questionImages}>
              {files.filter((f) => f.isImage).map((f, fi) => (
                <Image key={fi} source={{ uri: f.uri }} style={styles.questionImage} resizeMode="contain" />
              ))}
            </View>
          ) : null}
        </View>
      )}

      {q.answer && (
        <View style={styles.answerBlock}>
          <Text style={styles.answerTitle}>答案</Text>
          <MathView text={q.answer} style={styles.answerContent} />
        </View>
      )}

      {q.analysis && (
        <View style={styles.resultBlock}>
          <Text style={styles.blockTitle}>解题思路点拨</Text>
          <MathText text={q.analysis} style={styles.blockContent} />
        </View>
      )}

      {q.solution && (
        <View style={styles.resultBlock}>
          <Text style={styles.blockTitle}>解答</Text>
          <MathView text={q.solution} style={styles.blockContent} />
        </View>
      )}

      {(q.knowledge_points || q.core_competency || q.difficulty) && (
        <View style={styles.metaBlock}>
          {q.knowledge_points && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>学科知识点</Text>
              <Text style={styles.metaValue}>{q.knowledge_points}</Text>
            </View>
          )}
          {q.core_competency && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>学科核心素养</Text>
              <Text style={styles.metaValue}>{q.core_competency}</Text>
            </View>
          )}
          {q.difficulty && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>难度</Text>
              <View style={styles.difficultyBadge}>
                <Text style={styles.difficultyTextL}>{q.difficulty}</Text>
              </View>
            </View>
          )}
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
    </View>
  );

  const handleFavorite = async (question: QuestionResult) => {
    setFavoriteLoading(true);
    try {
      // 收藏时把原图传给后端，由后端后台把图片转成文字题干后入库
      const formData = new FormData();

      const firstFile = files.find((f) => f.isImage) || files[0];
      // 图片转 blob（与 solveProblem 一致的处理）
      let blob: Blob;
      try {
        if (firstFile.uri.startsWith('data:')) {
          const arr = firstFile.uri.split(',');
          const base64 = arr[1];
          const mimeMatch = arr[0].match(/:(.*?);/);
          const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
          const bstr = atob(base64);
          const u8 = new Uint8Array(bstr.length);
          for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
          blob = new Blob([u8], { type: mime });
        } else {
          const response = await fetch(firstFile.uri);
          blob = await response.blob();
        }
      } catch (e) {
        console.error('[Search] fav image convert failed:', e);
        blob = new Blob([], { type: 'image/jpeg' });
      }

      if (Platform.OS === 'web') {
        formData.append('image', blob, firstFile.name || 'problem.jpg');
      } else {
        formData.append('image', {
          uri: firstFile.uri,
          name: firstFile.name || 'problem.jpg',
          type: firstFile.type || blob.type || 'image/jpeg',
        } as any);
      }

      const res = await fetch('/api/v1/favorites', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        const warnMsg = data.data && data.data.warn ? '\n（题目文字识别失败，已保存原图）' : '';
        alert((data.message || '收藏成功') + warnMsg);
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
        const newFiles = result.assets.map((a) => ({ uri: a.uri, name: `拍照_${Date.now()}.jpg`, type: 'image/jpeg', isImage: true }));
        const all = [...files, ...newFiles];
        setFiles(all);
        setResult(null);
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
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newFiles = result.assets.map((a, idx) => ({ uri: a.uri, name: `相册图片_${Date.now()}_${idx}.jpg`, type: 'image/jpeg', isImage: true }));
        const all = [...files, ...newFiles];
        setFiles(all);
        setResult(null);
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
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.wps-office.doc', 'application/vnd.wps-office.docx', 'image/*'],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled) {
        return;
      }

      const newFiles = result.assets.map((f) => {
        const lower = (f.name || '').toLowerCase();
        const isImage = /\.(png|jpe?g|gif|webp|heic)$/.test(lower);
        const type = isImage ? 'image/jpeg' : 'application/octet-stream';
        return { uri: f.uri, name: f.name || '文件', type, isImage };
      });
      const all = [...files, ...newFiles];
      setFiles(all);
      setResult(null);
    } catch (err) {
      console.error('Document picker error:', err);
      alert('选择文件失败，请重试');
    }
  };

  const handleReselect = () => {
    // 清空当前文件，重新选择
    setFiles([]);
    setResult(null);
    setShowImagePicker(true);
  };

  const handleStartSearch = () => {
    if (files.length === 0) return;
    solveProblem(files);
  };

  const handleRemoveFile = (idx: number) => {
    const next = files.filter((_, i) => i !== idx);
    setFiles(next);
    setResult(null);
    setShowImagePicker(false);
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
          {/* Show selected files (images + docs) if available */}
          {files.length > 0 && (
            <View style={styles.imageSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>已选文件（{files.length}）</Text>
                <TouchableOpacity onPress={handleReselect}>
                  <Text style={styles.reselectText}>清除重选</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.fileGrid}>
                {files.map((f, idx) => (
                  <View key={idx} style={styles.fileThumbWrap}>
                    {f.isImage ? (
                      <Image source={{ uri: f.uri }} style={styles.fileThumb} resizeMode="contain" />
                    ) : (
                      <View style={[styles.fileThumb, styles.docThumb]}>
                        <Ionicons name="document-text" size={28} color="#4A90E2" />
                      </View>
                    )}
                    <TouchableOpacity style={styles.fileRemoveBtn} onPress={() => handleRemoveFile(idx)}>
                      <Ionicons name="close-circle" size={18} color="#FF6B6B" />
                    </TouchableOpacity>
                    <Text numberOfLines={1} style={styles.fileName}>{f.name}</Text>
                  </View>
                ))}
                <TouchableOpacity style={styles.addFileBtn} onPress={() => setShowImagePicker(true)}>
                  <Ionicons name="add" size={22} color="#4A90E2" />
                  <Text style={styles.addFileBtnText}>继续添加</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* 解析模式切换：默认精炼(快)，可切详细 */}
          {files.length > 0 && (
            <View style={styles.modeBar}>
              <Text style={styles.modeLabel}>解析模式</Text>
              <TouchableOpacity
                style={[styles.modeBtn, !detailedMode && styles.modeBtnActive]}
                onPress={() => setDetailedMode(false)}
              >
                <Text style={[styles.modeBtnText, !detailedMode && styles.modeBtnTextActive]}>精炼</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, detailedMode && styles.modeBtnActive]}
                onPress={() => setDetailedMode(true)}
              >
                <Text style={[styles.modeBtnText, detailedMode && styles.modeBtnTextActive]}>详细</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 开始搜题确认按钮 */}
          {files.length > 0 && !result && !loading && (
            <TouchableOpacity style={[styles.searchBtn, { marginTop: 8 }]} onPress={handleStartSearch}>
              <Ionicons name="search" size={20} color="#fff" />
              <Text style={styles.searchBtnText}>开始搜题</Text>
            </TouchableOpacity>
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
                  {result.questions && result.questions.length > 1 ? (
                    <>
                      <View style={styles.pagerHeader}>
                        <TouchableOpacity
                          style={styles.pagerArrow}
                          disabled={activePage === 0}
                          onPress={() => {
                            const p = document.getElementById(`qpage-${activePage - 1}`);
                            if (p) p.scrollIntoView({ behavior: 'smooth', inline: 'nearest' });
                            setActivePage(activePage - 1);
                          }}
                        >
                          <Ionicons name="chevron-back" size={22} color={activePage === 0 ? '#CCC' : '#4A90E2'} />
                        </TouchableOpacity>
                        <Text style={styles.pagerIndicator}>第 {activePage + 1} / {result.questions.length} 题</Text>
                        <TouchableOpacity
                          style={styles.pagerArrow}
                          disabled={activePage === result.questions.length - 1}
                          onPress={() => {
                            const p = document.getElementById(`qpage-${activePage + 1}`);
                            if (p) p.scrollIntoView({ behavior: 'smooth', inline: 'nearest' });
                            setActivePage(activePage + 1);
                          }}
                        >
                          <Ionicons name="chevron-forward" size={22} color={activePage === result.questions.length - 1 ? '#CCC' : '#4A90E2'} />
                        </TouchableOpacity>
                      </View>
                      <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onMomentumScrollEnd={(e) => {
                          const off = e.nativeEvent.contentOffset.x;
                          setActivePage(Math.round(off / winWidth));
                        }}
                        style={styles.pagerScroll}
                      >
                        {result.questions.map((q, index) => (
                          <View key={index} id={`qpage-${index}`} style={[styles.pagerPage, { width: winWidth - 32 }]}>
                            {renderQuestionCard(q, index)}
                          </View>
                        ))}
                      </ScrollView>
                    </>
                  ) : result.questions ? (
                    result.questions.map((q, index) => (
                      renderQuestionCard(q, index)
                    ))
                  ) : null}

                      </>
              )}
            </View>
          )}

          {/* Empty State */}
          {files.length === 0 && !loading && !result && (
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  reselectText: {
    fontSize: 13,
    color: '#4A90E2',
  },
  fileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  addFileBtn: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F6FF',
    gap: 4,
  },
  addFileBtnText: {
    color: '#4A90E2',
    fontSize: 12,
  },
  searchBtn: {
    backgroundColor: '#4A90E2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 10,
  },
  searchBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fileThumbWrap: {
    width: 100,
    marginBottom: 6,
  },
  fileThumb: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  docThumb: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF3FB',
  },
  fileRemoveBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#fff',
    borderRadius: 9,
  },
  fileName: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  questionImages: {
    gap: 10,
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
  modeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  modeLabel: {
    fontSize: 13,
    color: '#888',
    marginRight: 2,
  },
  modeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: '#FFF',
  },
  modeBtnActive: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  modeBtnText: {
    fontSize: 13,
    color: '#666',
  },
  modeBtnTextActive: {
    color: '#FFF',
  },
  questionImage: {
    width: '100%',
    height: 240,
    borderRadius: 8,
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
  pagerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  pagerIndicator: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  pagerArrow: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#EEF4FC',
  },
  pagerScroll: {
    flexGrow: 0,
  },
  pagerPage: {
    paddingRight: 4,
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
  difficultyTextL: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4338CA',
  },
  metaBlock: {
    marginBottom: 20,
    backgroundColor: '#F5F3FF',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6D28D9',
    width: undefined,
  },
  metaValue: {
    fontSize: 13,
    color: '#4C1D95',
    flex: 1,
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
