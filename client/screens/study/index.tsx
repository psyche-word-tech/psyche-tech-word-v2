import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, Modal, Platform, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontAwesome6 } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { getApiBaseUrl } from '@/utils/apiConfig';

// 雷达图 SVG 图标组件
const RadarChartIcon = ({ size = 22, color = '#FFFFFF' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M12 6L17.33 9V15L12 18L6.67 15V9L12 6Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M12 10L14 11V13L12 14L10 13V11L12 10Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
    <line x1="12" y1="2" x2="12" y2="6" stroke={color} strokeWidth="1.5"/>
    <line x1="20.66" y1="7" x2="17.33" y2="9" stroke={color} strokeWidth="1.5"/>
    <line x1="20.66" y1="17" x2="17.33" y2="15" stroke={color} strokeWidth="1.5"/>
    <line x1="12" y1="22" x2="12" y2="18" stroke={color} strokeWidth="1.5"/>
    <line x1="3.34" y1="17" x2="6.67" y2="15" stroke={color} strokeWidth="1.5"/>
    <line x1="3.34" y1="7" x2="6.67" y2="9" stroke={color} strokeWidth="1.5"/>
  </svg>
);

const iconRock = require('@/assets/iconRock.png');
const iconMyVocab = require('@/assets/my-vocab.png');
const region4Bg = require('@/assets/region4-bg.webp');
const regionAImg = require('@/assets/region-a.webp');
const regionBImg = require('@/assets/region-b.webp');

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HALF_HEIGHT = SCREEN_HEIGHT / 2; // 一半高度

export default function StudyScreen() {
  const router = useSafeRouter();
  const { user } = useAuth();
  const params = useSafeSearchParams<{ engravedText?: string }>();
  const engravedText = params.engravedText || '';
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSubmissionMenu, setShowSubmissionMenu] = useState(false);
  const [showIrisAnalysis, setShowIrisAnalysis] = useState(false);
  const [irisData, setIrisData] = useState<any[]>([]);
  const [loadingIris, setLoadingIris] = useState(false);

  const handleLoadIrisData = async () => {
    setLoadingIris(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/iris/iris-data`);
      const data = await response.json();
      if (data.success) {
        setIrisData(data.data || []);
      }
    } catch (error) {
      console.error('加载虹膜数据失败:', error);
    } finally {
      setLoadingIris(false);
    }
  };

  const handleTakePhoto = async () => {
    setShowImagePicker(false);
    
    if (Platform.OS === 'web') {
      // Web 端使用 getUserMedia 调用摄像头
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        
        // 创建视频元素
        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        video.style.position = 'fixed';
        video.style.top = '0';
        video.style.left = '0';
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'cover';
        video.style.zIndex = '9999';
        
        // 创建画布元素
        const canvas = document.createElement('canvas');
        
        // 创建拍照按钮
        const captureBtn = document.createElement('button');
        captureBtn.textContent = '拍照';
        captureBtn.style.position = 'fixed';
        captureBtn.style.bottom = '100px';
        captureBtn.style.left = '50%';
        captureBtn.style.transform = 'translateX(-50%)';
        captureBtn.style.padding = '15px 30px';
        captureBtn.style.fontSize = '18px';
        captureBtn.style.backgroundColor = '#fff';
        captureBtn.style.border = 'none';
        captureBtn.style.borderRadius = '30px';
        captureBtn.style.zIndex = '10000';
        captureBtn.style.cursor = 'pointer';
        
        // 创建关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '关闭';
        closeBtn.style.position = 'fixed';
        closeBtn.style.top = '20px';
        closeBtn.style.right = '20px';
        closeBtn.style.padding = '10px 20px';
        closeBtn.style.fontSize = '16px';
        closeBtn.style.backgroundColor = '#fff';
        closeBtn.style.border = 'none';
        closeBtn.style.borderRadius = '20px';
        closeBtn.style.zIndex = '10000';
        closeBtn.style.cursor = 'pointer';
        
        document.body.appendChild(video);
        document.body.appendChild(captureBtn);
        document.body.appendChild(closeBtn);
        
        // 拍照按钮点击事件
        captureBtn.onclick = () => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0);
            const uri = canvas.toDataURL('image/jpeg', 0.8);
            
            // 清理
            stream.getTracks().forEach(track => track.stop());
            document.body.removeChild(video);
            document.body.removeChild(captureBtn);
            document.body.removeChild(closeBtn);
            
            router.push('/search', { imageUri: uri });
          }
        };
        
        // 关闭按钮点击事件
        closeBtn.onclick = () => {
          stream.getTracks().forEach(track => track.stop());
          document.body.removeChild(video);
          document.body.removeChild(captureBtn);
          document.body.removeChild(closeBtn);
        };
      } catch (err) {
        console.error('摄像头访问失败:', err);
        // 如果摄像头访问失败，回退到文件选择
        handlePickFromLibrary();
      }
      return;
    }
    
    // 移动端使用 expo-image-picker
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return;
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        router.push('/search', { imageUri: result.assets[0].uri });
      }
    } catch (e) {
      handlePickFromLibrary();
    }
  };

  const handlePickFromLibrary = async () => {
    setShowImagePicker(false);
    
    if (Platform.OS === 'web') {
      // Web 端使用隐藏的 input 元素选择图片
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const uri = event.target?.result as string;
            router.push('/search', { imageUri: uri });
          };
          reader.readAsDataURL(file);
        }
        document.body.removeChild(input);
      };
      
      document.body.appendChild(input);
      input.click();
      return;
    }
    
    // 移动端使用 expo-image-picker
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        router.push('/search', { imageUri: result.assets[0].uri });
      }
    } catch (e) {
      // Silently fail
    }
  };

  const handleUploadFile = async () => {
    setShowImagePicker(false);
    
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain'],
        copyToCacheDirectory: true,
      });
      
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }
      
      const file = result.assets[0];
      const fileName = file.name || 'uploaded_file';
      const fileUri = file.uri;
      
      // 跳转到搜索页面并传递文件信息
      router.push('/search', { 
        imageUri: fileUri,
        fileName: fileName,
        isFile: true 
      });
    } catch (error) {
      console.error('文件上传失败:', error);
      Alert.alert('错误', '文件上传失败，请重试');
    }
  };

  return (
    <Screen safeAreaEdges={[]}>
      <View style={styles.container}>
        {/* 上半部分：区域一（100% 宽，50% 高） */}
        <View style={styles.topCardWrapper}>
          <TouchableOpacity 
            style={styles.topCard} 
            activeOpacity={0.9} 
            onPress={() => router.push('/engrave')}
          >
            <Image source={iconRock} style={styles.topImage} resizeMode="stretch" />
            {engravedText.length > 0 && (
              <View style={[styles.engravedTextContainer, { position: 'absolute', top: HALF_HEIGHT / 3 + 55, flexDirection: 'column', alignItems: 'center' }]}>
                {engravedText.split(' ').map((word, wordIndex) => (
                  <View key={wordIndex} style={{ flexDirection: 'row', marginVertical: 5 }}>
                    {word.split('').map((char, charIndex) => (
                      <View key={charIndex} style={{ marginHorizontal: 15 }}>
                        <Text style={styles.engravedText}>{char}</Text>
                        <Text style={styles.engravedTextHighlight}>{char}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </TouchableOpacity>
          {/* Search Icon - Top Right */}
          <View style={styles.topRightButtons}>
            <TouchableOpacity 
              style={styles.searchButton}
              activeOpacity={0.7}
              onPress={() => setShowImagePicker(true)}
            >
              <Ionicons name="search" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.searchButton}
              activeOpacity={0.7}
              onPress={() => setShowHistory(true)}
            >
              <Ionicons name="time-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.searchButton}
              activeOpacity={0.7}
              onPress={() => router.push('/competency-map')}
            >
              <RadarChartIcon size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.searchButton}
              activeOpacity={0.7}
              onPress={() => {
                if (user?.role === 'teacher') {
                  router.push('/teacher-review');
                } else {
                  setShowSubmissionMenu(true);
                }
              }}
            >
              <Ionicons name="add" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 下半部分：2x2 田字格（区域二、三、四、五） */}
        <View style={styles.bottomSection}>
          {/* 上一行：区域二（左右分栏：区域a、区域b） */}
          <View style={styles.bottomRow}>
            <TouchableOpacity 
              style={styles.gridItem} 
              activeOpacity={0.9} 
              onPress={() => router.push('/vocabulary')}
            >
              <Image source={regionAImg} style={styles.regionAStyle} resizeMode="stretch" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.gridItem} 
              activeOpacity={0.9} 
              onPress={() => router.push('/calendar')}
            >
              <Image source={regionBImg} style={styles.regionAStyle} resizeMode="stretch" />
            </TouchableOpacity>
          </View>
          {/* 下一行：区域四、区域五 */}
          <View style={styles.bottomRow}>
            <TouchableOpacity 
              style={styles.gridItem}
              activeOpacity={0.9}
              onPress={() => router.push(user ? '/profile' : '/login')}
            >
              <Image source={region4Bg} style={styles.gridImageFull} resizeMode="cover" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.gridItem, { borderWidth: 0 }]} 
              activeOpacity={0.9} 
              onPress={() => router.push('/my-vocabulary')}
            >
              <Image source={iconMyVocab} style={styles.gridImageFull} resizeMode="stretch" />
              <View style={[styles.labelContainer, { marginTop: -10 }]}>
                <Text style={styles.gridLabel}>我的词汇书</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>

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
            <TouchableOpacity 
              style={styles.modalButton} 
              onPress={handleTakePhoto}
              activeOpacity={0.7}
            >
              <Ionicons name="camera" size={24} color="#333" />
              <Text style={styles.modalButtonText}>拍照</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.modalButton} 
              onPress={handlePickFromLibrary}
              activeOpacity={0.7}
            >
              <Ionicons name="images" size={24} color="#333" />
              <Text style={styles.modalButtonText}>从相册选择</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.modalButton} 
              onPress={handleUploadFile}
              activeOpacity={0.7}
            >
              <Ionicons name="document-text" size={24} color="#333" />
              <Text style={styles.modalButtonText}>上传文件</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.modalCancelButton} 
              onPress={() => setShowImagePicker(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCancelText}>取消</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 历史记录 Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showHistory}
        onRequestClose={() => setShowHistory(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowHistory(false)}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>历史记录</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity
                  onPress={() => {
                    setShowHistory(false);
                    handleLoadIrisData();
                    setShowIrisAnalysis(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="eye-outline" size={22} color="#3B82F6" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowHistory(false)}>
                  <Text style={styles.modalCloseBtn}></Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.modalBody}>
              <Text style={{ color: '#999', textAlign: 'center', marginTop: 40 }}>
                暂无历史记录
              </Text>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 虹膜分析结果 Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showIrisAnalysis}
        onRequestClose={() => setShowIrisAnalysis(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowIrisAnalysis(false)}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>学习状态分析</Text>
              <TouchableOpacity onPress={() => setShowIrisAnalysis(false)}>
                <Text style={styles.modalCloseBtn}></Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {irisData.length === 0 ? (
                <Text style={{ color: '#999', textAlign: 'center', marginTop: 40 }}>
                  暂无学习状态数据
                </Text>
              ) : (
                <>
                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ color: '#666', fontSize: 14, marginBottom: 8 }}>
                      平均专注度
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View
                        style={{
                          flex: 1,
                          height: 8,
                          backgroundColor: '#E5E7EB',
                          borderRadius: 4,
                          marginRight: 12,
                        }}
                      >
                        <View
                          style={{
                            width: `${avgFocus}%`,
                            height: '100%',
                            backgroundColor: '#10B981',
                            borderRadius: 4,
                          }}
                        />
                      </View>
                      <Text style={{ color: '#10B981', fontWeight: 'bold', fontSize: 16 }}>
                        {avgFocus.toFixed(1)}%
                      </Text>
                    </View>
                  </View>

                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ color: '#666', fontSize: 14, marginBottom: 8 }}>
                      情绪分布
                    </Text>
                    {Object.entries(emotionDistribution).map(([emotion, count]) => (
                      <View key={emotion} style={{ flexDirection: 'row', marginBottom: 6 }}>
                        <Text style={{ color: '#333', width: 60 }}>{emotion}</Text>
                        <View style={{ flex: 1, height: 6, backgroundColor: '#E5E7EB', borderRadius: 3 }}>
                          <View
                            style={{
                              width: `${(count / irisData.length) * 100}%`,
                              height: '100%',
                              backgroundColor: '#3B82F6',
                              borderRadius: 3,
                            }}
                          />
                        </View>
                        <Text style={{ color: '#666', marginLeft: 8 }}>{count}次</Text>
                      </View>
                    ))}
                  </View>

                  <View>
                    <Text style={{ color: '#666', fontSize: 14, marginBottom: 8 }}>
                      视线分布
                    </Text>
                    {Object.entries(gazeDistribution).map(([gaze, count]) => (
                      <View key={gaze} style={{ flexDirection: 'row', marginBottom: 6 }}>
                        <Text style={{ color: '#333', width: 60 }}>{gaze}</Text>
                        <View style={{ flex: 1, height: 6, backgroundColor: '#E5E7EB', borderRadius: 3 }}>
                          <View
                            style={{
                              width: `${(count / irisData.length) * 100}%`,
                              height: '100%',
                              backgroundColor: '#8B5CF6',
                              borderRadius: 3,
                            }}
                          />
                        </View>
                        <Text style={{ color: '#666', marginLeft: 8 }}>{count}次</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 提交/批改菜单 Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showSubmissionMenu}
        onRequestClose={() => setShowSubmissionMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSubmissionMenu(false)}
        >
          <TouchableOpacity
            style={styles.submissionMenuContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {user?.role !== 'teacher' && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowSubmissionMenu(false);
                  router.push('/submit-homework');
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="cloud-upload-outline" size={24} color="#3B82F6" />
                <Text style={styles.menuItemText}>提交作业</Text>
              </TouchableOpacity>
            )}
            {user?.role === 'teacher' && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowSubmissionMenu(false);
                  router.push('/teacher-review');
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="checkmark-circle-outline" size={24} color="#10B981" />
                <Text style={styles.menuItemText}>批改作业</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // 文字在区域下方居中
  labelContainer: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topCard: {
    height: HALF_HEIGHT,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topCardWrapper: {
    position: 'relative',
    height: HALF_HEIGHT,
    width: '100%',
  },
  topRightButtons: {
    position: 'absolute',
    top: 70,
    right: 20,
    flexDirection: 'row',
    gap: 10,
    zIndex: 10,
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topImage: {
    width: '100%',
    height: '100%',
    marginTop: 50,
  },
  topLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  // 下半部分：2x2 排列（区域二、三、四、五）
  bottomSection: {
    height: HALF_HEIGHT,
    width: '100%',
  },
  gridRow: {
    flex: 1,
    flexDirection: 'row',
  },
  bottomRow: {
    height: 177,
    flexDirection: 'row',
  },
  gridItem: {
    flex: 1,
  },
  regionAStyle: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  gridImageFull: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  region4Image: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  dangImage: {
    width: 160,
    height: 160,
    marginLeft: -20,
    marginTop: -1,
  },
  gridLabel: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '600',
  },
  emptyCard: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridIcon: {
    width: 48,
    height: 48,
  },
  engravedTextContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  engravedWordColumn: {
    flexDirection: 'column',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  engravedCharWrapper: {
    position: 'relative',
  },
  // 刻字主体
  engravedText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  // 高光层
  engravedTextHighlight: {
    position: 'absolute',
    top: -0.5,
    left: -0.5,
    fontSize: 20,
    fontWeight: 'bold',
    color: 'rgba(255,255,255,0.9)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 320,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 14,
    marginBottom: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    gap: 10,
  },
  modalButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  modalCancelButton: {
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  modalCancelText: {
    fontSize: 16,
    color: '#999',
  },
  historyModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    maxHeight: '70%',
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  historyItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 8,
  },
  historyItemText: {
    fontSize: 14,
    color: '#333',
  },
  historyEmpty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  historyEmptyText: {
    fontSize: 14,
    color: '#999',
  },
  submissionMenuContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    width: '70%',
    maxWidth: 300,
    alignSelf: 'center',
    marginTop: '30%',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuItemText: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
});
