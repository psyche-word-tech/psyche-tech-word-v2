import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, Modal } from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useState, useEffect, useRef } from 'react';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { irisRecognitionService } from '@/utils/irisRecognition';
import { getApiBaseUrl } from '@/utils/apiConfig';

export default function SettingsScreen() {
  const router = useSafeRouter();
  const { logout, user } = useAuth();
  const [elderMode, setElderMode] = useState(false);
  const [showIrisModal, setShowIrisModal] = useState(false);
  const [irisEnabled, setIrisEnabled] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionIdRef = useRef<string>('');

  const handleLogout = () => {
    logout().then(() => {
      router.replace('/login');
    }).catch((error) => {
      console.error('退出登录失败:', error);
      Alert.alert('错误', '退出登录失败，请重试');
    });
  };

  const startIrisRecognition = async () => {
    if (!videoRef.current) return;
    
    setIsStarting(true);
    sessionIdRef.current = `session_${Date.now()}`;
    
    try {
      await irisRecognitionService.loadModels();
      
      await irisRecognitionService.startVideo(videoRef.current, async (result) => {
        // 保存识别结果到后端
        try {
          const response = await fetch(`${getApiBaseUrl()}/api/iris/iris-data`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sessionId: sessionIdRef.current,
              emotion: result.emotion,
              focusScore: result.focusScore,
              gazeDirection: result.gazeDirection,
            }),
          });
          const data = await response.json();
          if (!data.success) {
            console.error('保存虹膜数据失败:', data.error);
          }
        } catch (error) {
          console.error('保存虹膜数据失败:', error);
        }
      });
      
      setIrisEnabled(true);
      Alert.alert('提示', '虹膜识别功能已启动，系统将开始监测您的学习状态');
    } catch (error) {
      console.error('启动虹膜识别失败:', error);
      Alert.alert('错误', '启动虹膜识别失败，请检查摄像头权限');
    } finally {
      setIsStarting(false);
    }
  };

  const stopIrisRecognition = () => {
    irisRecognitionService.stop();
    setIrisEnabled(false);
    Alert.alert('提示', '虹膜识别功能已关闭');
  };

  const settingsItems = [
    {
      id: 'account',
      title: '账号管理',
      showIcons: true,
      iconColors: ['#FF6B35', '#07C160', '#9CA3AF'],
    },
    {
      id: 'study-reminder',
      title: '学习提醒',
      arrow: true,
    },
    {
      id: 'study-settings',
      title: '学习设置',
      arrow: true,
    },
    {
      id: 'display-settings',
      title: '显示设置',
      arrow: true,
    },
    {
      id: 'privacy-settings',
      title: '隐私设置',
      arrow: true,
    },
    {
      id: 'elder-mode',
      title: '长辈版',
      isToggle: true,
      value: elderMode,
      onToggle: setElderMode,
    },
    {
      id: 'cache',
      title: '缓存管理',
      arrow: true,
    },
    {
      id: 'privacy-list',
      title: '个人信息收集清单',
      arrow: true,
    },
    {
      id: 'third-party',
      title: '第三方合作清单',
      arrow: true,
    },
    {
      id: 'about',
      title: '关于我们',
      arrow: true,
    },
    {
      id: 'iris-recognition',
      title: '虹膜识别',
      arrow: true,
    },
  ];

  return (
    <Screen>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>设置</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Settings List */}
        <View style={styles.listContainer}>
          {settingsItems.map((item, index) => (
            <TouchableOpacity 
              key={item.id}
              style={[
                styles.listItem,
                index === 0 && styles.listItemFirst,
                index === settingsItems.length - 1 && styles.listItemLast,
              ]}
              activeOpacity={item.isToggle ? 1 : 0.7}
              onPress={() => {
                if (item.id === 'iris-recognition') {
                  setShowIrisModal(true);
                }
              }}
            >
              <Text style={styles.itemTitle}>{item.title}</Text>
              
              {/* Right Side Content */}
              <View style={styles.itemRight}>
                {/* Toggle Switch */}
                {item.isToggle && (
                  <Switch
                    value={item.value}
                    onValueChange={item.onToggle}
                    trackColor={{ false: '#E0E0E0', true: '#4F46E5' }}
                    thumbColor="#FFFFFF"
                    style={styles.switch}
                  />
                )}
                
                {/* Icon Group for Account */}
                {item.showIcons && (
                  <View style={styles.iconGroup}>
                    <View style={[styles.iconBadge, { backgroundColor: item.iconColors[0] }]}>
                      <FontAwesome name="mobile-phone" size={14} color="#FFFFFF" />
                    </View>
                    <View style={[styles.iconBadge, { backgroundColor: item.iconColors[1] }]}>
                      <FontAwesome name="weixin" size={12} color="#FFFFFF" />
                    </View>
                    <View style={[styles.iconBadge, { backgroundColor: item.iconColors[2] }]}>
                      <FontAwesome name="qq" size={12} color="#FFFFFF" />
                    </View>
                  </View>
                )}
                
                {/* Arrow */}
                {item.arrow && (
                  <Text style={styles.arrow}>›</Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bottom Logout Button */}
        <View style={styles.bottomContainer}>
          {irisEnabled && (
            <TouchableOpacity 
              style={styles.stopIrisButton}
              activeOpacity={0.8}
              onPress={stopIrisRecognition}
            >
              <Text style={styles.stopIrisText}>关闭虹膜识别</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={styles.logoutButton}
            activeOpacity={0.8}
            onPress={handleLogout}
          >
            <Text style={styles.logoutText}>退出登录</Text>
          </TouchableOpacity>
        </View>

        {/* Hidden Video Element for Iris Recognition */}
        <video
          ref={videoRef}
          style={{ display: 'none' }}
          autoPlay
          playsInline
          muted
        />

        {/* Iris Recognition Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={showIrisModal}
          onRequestClose={() => setShowIrisModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowIrisModal(false)}
          >
            <TouchableOpacity
              style={styles.modalContent}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={styles.modalTitle}>虹膜识别</Text>
              <Text style={styles.modalDescription}>
                开通后系统将识别您的眼神和面部表情数据，您学习时的专注程度，对题目难度的反应将会被推断，结果仅自己可见
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButtonPrimary, isStarting && styles.modalButtonDisabled]}
                  onPress={() => {
                    setShowIrisModal(false);
                    startIrisRecognition();
                  }}
                  activeOpacity={0.7}
                  disabled={isStarting}
                >
                  <Text style={styles.modalButtonPrimaryText}>
                    {isStarting ? '启动中...' : '开通'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalButtonSecondary}
                  onPress={() => setShowIrisModal(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalButtonSecondaryText}>暂不开通</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backButton: {
    padding: 4,
    width: 40,
  },
  backText: {
    fontSize: 24,
    color: '#333333',
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: 17,
    color: '#333333',
    fontWeight: '600',
  },
  headerRight: {
    width: 40,
  },
  listContainer: {
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  listItemFirst: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  listItemLast: {
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderBottomWidth: 0,
  },
  itemTitle: {
    fontSize: 15,
    color: '#333333',
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconGroup: {
    flexDirection: 'row',
    marginRight: 8,
  },
  iconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  switch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  arrow: {
    fontSize: 20,
    color: '#CCCCCC',
    fontWeight: '300',
  },
  bottomContainer: {
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 40,
  },
  logoutButton: {
    backgroundColor: '#FFF1F0',
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 15,
    color: '#FF4D4F',
    fontWeight: '500',
  },
  stopIrisButton: {
    backgroundColor: '#E0E7FF',
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
    marginBottom: 12,
  },
  stopIrisText: {
    fontSize: 15,
    color: '#4F46E5',
    fontWeight: '500',
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 22,
    marginBottom: 24,
    textAlign: 'center',
  },
  modalButtons: {
    gap: 12,
  },
  modalButtonPrimary: {
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonPrimaryText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalButtonSecondary: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonSecondaryText: {
    fontSize: 15,
    color: '#666666',
    fontWeight: '500',
  },
});
