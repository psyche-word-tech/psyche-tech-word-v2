import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ScrollView, Modal } from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons, FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { getApiBaseUrl } from '@/utils/apiConfig';
import { fetchWithRetry } from '@/utils/apiClient';
import { useState } from 'react';

export default function ProfileScreen() {
  const router = useSafeRouter();
  const { user, logout } = useAuth();

  const roleLabel = user?.role === 'teacher' ? '教师' : '学生';

  // 用户数据（实际应从API获取）
  const userData = {
    username: user?.username || '学习达人',
    phone: user?.phone ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '未登录',
    role: roleLabel,
    avatar: null,
    stats: {
      learningDays: 128,
      totalWords: 2560,
      masteredWords: 890,
    },
  };

  const handleLogout = () => {
    logout().then(() => {
      router.replace('/login');
    }).catch((error) => {
      console.error('退出登录失败:', error);
      Alert.alert('错误', '退出登录失败，请重试');
    });
  };

  const handleDeleteAccount = () => {
    const confirmed = window.confirm('注销后账号数据将被永久删除且无法恢复，确定要注销吗？');
    if (!confirmed) return;

    const deleteAccount = async () => {
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/delete-account`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user?.id }),
        });
        const data = await response.json();
        if (data.success) {
          await logout();
          window.alert('账号已注销');
          router.replace('/login');
        } else {
          window.alert('注销失败: ' + (data.error || '未知错误'));
        }
      } catch (error) {
        console.error('注销账号失败:', error);
        window.alert('注销失败，请重试');
      }
    };

    deleteAccount();
  };

  const [showIrisModal, setShowIrisModal] = useState(false);
  const [showIrisEnableModal, setShowIrisEnableModal] = useState(false);
  const [irisEnabled, setIrisEnabled] = useState(false);
  const [irisData, setIrisData] = useState<any>(null);

  const checkIrisStatus = async () => {
    try {
      const response = await fetchWithRetry(`${getApiBaseUrl()}/api/iris/status`, {
        method: 'GET',
      });
      const data = await response.json();
      if (data.success) {
        setIrisEnabled(data.enabled || false);
      }
    } catch (error) {
      console.error('检查虹膜状态失败:', error);
    }
  };

  const handleIrisButtonClick = () => {
    checkIrisStatus();
    setShowIrisEnableModal(true);
  };

  const handleEnableIris = async () => {
    try {
      const response = await fetchWithRetry(`${getApiBaseUrl()}/api/iris/enable`, {
        method: 'POST',
        body: JSON.stringify({ enabled: true }),
      });
      const data = await response.json();
      if (data.success) {
        setIrisEnabled(true);
        setShowIrisEnableModal(false);
        window.alert('虹膜识别已开通');
      } else {
        window.alert(data.error || '开通失败');
      }
    } catch (error) {
      console.error('开通虹膜识别失败:', error);
      window.alert('开通失败，请重试');
    }
  };

  const loadIrisData = async () => {
    try {
      const response = await fetchWithRetry(`${getApiBaseUrl()}/api/iris/iris-data`, {
        method: 'GET',
      });
      const data = await response.json();
      if (data.success && data.data && data.data.length > 0) {
        const records = data.data;
        const avgFocus = records.reduce((sum: number, r: any) => sum + (r.focus_score || 0), 0) / records.length;
        const emotions = records.map((r: any) => r.emotion).filter(Boolean);
        const mainEmotion = emotions.length > 0 ? emotions.reduce((a: string, b: string) =>
          emotions.filter((v: string) => v === a).length >= emotions.filter((v: string) => v === b).length ? a : b
        ) : '未知';
        const gazeCounts = records.reduce((acc: any, r: any) => {
          const dir = r.gaze_direction || 'center';
          acc[dir] = (acc[dir] || 0) + 1;
          return acc;
        }, {});
        const total = records.length;
        setIrisData({
          avgFocus: Math.round(avgFocus * 100),
          mainEmotion,
          gazeDistribution: {
            up: Math.round((gazeCounts['up'] || 0) / total * 100),
            down: Math.round((gazeCounts['down'] || 0) / total * 100),
            left: Math.round((gazeCounts['left'] || 0) / total * 100),
            right: Math.round((gazeCounts['right'] || 0) / total * 100),
            center: Math.round((gazeCounts['center'] || 0) / total * 100),
          },
          totalRecords: total,
        });
      } else {
        setIrisData(null);
      }
      setShowIrisModal(true);
    } catch (error) {
      console.error('加载虹膜数据失败:', error);
      Alert.alert('错误', '加载虹膜数据失败');
    }
  };

  const menuItems = [
    {
      id: 'vocabulary',
      title: '我的词汇书',
      icon: 'book',
      iconType: 'fontawesome',
      color: '#FF6B35',
      route: '/my-vocabulary',
    },
    {
      id: 'notebook',
      title: '生词本',
      icon: 'edit',
      iconType: 'fontawesome',
      color: '#4A90D9',
      route: '/notebook',
    },
    {
      id: 'progress',
      title: '学习进度',
      icon: 'chart-line',
      iconType: 'fontawesome',
      color: '#52C41A',
      route: '/study',
    },
    {
      id: 'achievements',
      title: '我的成就',
      icon: 'trophy',
      iconType: 'fontawesome',
      color: '#FAAD14',
      route: '/study',
    },
  ];

  const settingsItems = [
    { id: 'account', title: '账号管理', icon: 'person', route: '/settings' },
    { id: 'reminder', title: '学习提醒', icon: 'notifications', route: '/settings' },
    { id: 'display', title: '显示设置', icon: 'settings', route: '/settings' },
    { id: 'privacy', title: '隐私设置', icon: 'lock', route: '/settings' },
    { id: 'about', title: '关于我们', icon: 'info-circle', route: '/settings' },
  ];

  const renderIcon = (item: any) => {
    const iconProps = { name: item.icon, size: 22, color: item.color || '#666' };
    if (item.iconType === 'fontawesome') {
      return <FontAwesome {...iconProps} />;
    }
    return <Ionicons {...iconProps} />;
  };

  return (
    <Screen style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/study')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>个人中心</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* User Info Card */}
      <TouchableOpacity style={styles.userCard} onPress={() => router.push('/settings')}>
        <View style={styles.avatarContainer}>
          {userData.avatar ? (
            <Image source={{ uri: userData.avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <FontAwesome name="user" size={32} color="#fff" />
            </View>
          )}
          <View style={styles.vipBadge}>
            <MaterialIcons name="star" size={12} color="#FFD700" />
          </View>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.username}>{userData.username}</Text>
          <Text style={styles.phone}>{userData.phone}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{userData.role}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </TouchableOpacity>

      {/* Stats Section */}
      <View style={styles.statsContainer}>
        <View style={styles.statsItem}>
          <Text style={styles.statsNumber}>{userData.stats.learningDays}</Text>
          <Text style={styles.statsLabel}>学习天数</Text>
        </View>
        <View style={styles.statsDivider} />
        <View style={styles.statsItem}>
          <Text style={styles.statsNumber}>{userData.stats.totalWords}</Text>
          <Text style={styles.statsLabel}>已学单词</Text>
        </View>
        <View style={styles.statsDivider} />
        <View style={styles.statsItem}>
          <Text style={styles.statsNumber}>{userData.stats.masteredWords}</Text>
          <Text style={styles.statsLabel}>已掌握</Text>
        </View>
      </View>

      {/* Menu Section */}
      <View style={styles.menuSection}>
        <Text style={styles.sectionTitle}>我的学习</Text>
        <View style={styles.menuGrid}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              onPress={() => router.push(item.route)}
            >
              <View style={[styles.menuIconBg, { backgroundColor: item.color + '15' }]}>
                {renderIcon(item)}
              </View>
              <Text style={styles.menuText}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Settings List */}
      <View style={styles.settingsSection}>
        {settingsItems.map((item, index) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.settingsItem,
              index === settingsItems.length - 1 && styles.settingsItemLast,
            ]}
            onPress={() => router.push(item.route)}
          >
            <View style={styles.settingsLeft}>
              <Ionicons name={item.icon as any} size={20} color="#666" />
              <Text style={styles.settingsText}>{item.title}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
        ))}

        {/* Iris Recognition Button */}
        <TouchableOpacity style={styles.settingsItem} onPress={handleIrisButtonClick}>
          <View style={styles.settingsLeft}>
            <Ionicons name="eye-outline" size={20} color="#4CAF50" />
            <Text style={[styles.settingsText, { color: '#4CAF50' }]}>虹膜识别</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.statusBadge, { backgroundColor: irisEnabled ? '#4CAF50' : '#999' }]} />
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>退出登录</Text>
      </TouchableOpacity>

      {/* Delete Account Button */}
      <TouchableOpacity style={styles.deleteAccountBtn} onPress={handleDeleteAccount}>
        <Text style={styles.deleteAccountText}>注销账号</Text>
      </TouchableOpacity>

      {/* Iris Enable Modal */}
      {showIrisEnableModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>虹膜识别</Text>
              <TouchableOpacity onPress={() => setShowIrisEnableModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.irisEnableContent}>
              <Ionicons name="eye-outline" size={64} color="#4CAF50" style={{ marginBottom: 16 }} />
              <Text style={styles.irisEnableTitle}>
                {irisEnabled ? '虹膜识别已开通' : '开通虹膜识别'}
              </Text>
              <Text style={styles.irisEnableDesc}>
                {irisEnabled
                  ? '虹膜识别功能已开启，系统将实时监测您的学习状态'
                  : '开通后，系统将实时监测您的专注度、情绪和视线方向，帮助您更好地管理学习状态'}
              </Text>
              {irisEnabled ? (
                <TouchableOpacity style={styles.irisViewDataBtn} onPress={() => {
                  setShowIrisEnableModal(false);
                  loadIrisData();
                }}>
                  <Text style={styles.irisViewDataText}>查看学习数据</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.irisEnableBtn} onPress={handleEnableIris}>
                  <Text style={styles.irisEnableBtnText}>立即开通</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Iris Analysis Modal */}
      {showIrisModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>学习状态</Text>
              <TouchableOpacity onPress={() => setShowIrisModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {irisData.length === 0 ? (
                <Text style={styles.noDataText}>暂无学习状态数据</Text>
              ) : (
                <>
                  <View style={styles.irisCard}>
                    <Text style={styles.irisLabel}>平均专注度</Text>
                    <Text style={styles.irisValue}>
                      {Math.round(irisData.reduce((s, d) => s + (d.focusScore || 0), 0) / irisData.length * 100)}%
                    </Text>
                  </View>
                  <View style={styles.irisCard}>
                    <Text style={styles.irisLabel}>主要情绪</Text>
                    <Text style={styles.irisValue}>
                      {(() => {
                        const emotions = irisData.map(d => d.emotion || 'neutral');
                        const counts: Record<string, number> = {};
                        emotions.forEach(e => counts[e] = (counts[e] || 0) + 1);
                        return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';
                      })()}
                    </Text>
                  </View>
                  <View style={styles.irisCard}>
                    <Text style={styles.irisLabel}>视线分布</Text>
                    <Text style={styles.irisValue}>
                      {(() => {
                        const directions = irisData.map(d => d.gazeDirection || 'center');
                        const counts: Record<string, number> = {};
                        directions.forEach(d => counts[d] = (counts[d] || 0) + 1);
                        return Object.entries(counts).map(([k, v]) => `${k}: ${Math.round(v / irisData.length * 100)}%`).join(', ');
                      })()}
                    </Text>
                  </View>
                  <Text style={styles.dataCount}>共 {irisData.length} 条数据</Text>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      )}
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#fff',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  settingsBtn: {
    padding: 4,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4A90D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vipBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 2,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  username: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  phone: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  roleBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  roleText: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 16,
    borderRadius: 12,
  },
  statsItem: {
    flex: 1,
    alignItems: 'center',
  },
  statsNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
  },
  statsLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  statsDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#eee',
    alignSelf: 'center',
  },
  menuSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  menuItem: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  menuIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  menuText: {
    fontSize: 12,
    color: '#333',
  },
  settingsSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingsItemLast: {
    borderBottomWidth: 0,
  },
  settingsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsText: {
    fontSize: 15,
    color: '#333',
    marginLeft: 12,
  },
  logoutBtn: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 30,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 15,
    color: '#FF4D4F',
  },
  deleteAccountBtn: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 30,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  deleteAccountText: {
    fontSize: 14,
    color: '#999',
  },
  irisButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: '#10B981',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
  },
  irisButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxHeight: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  irisStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  irisStatLabel: {
    fontSize: 14,
    color: '#666',
  },
  irisStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  irisNoData: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    paddingVertical: 20,
  },
  irisEnableBtn: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  irisEnableBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
