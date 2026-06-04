import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons, FontAwesome, MaterialIcons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const router = useSafeRouter();
  const { user, logout } = useAuth();

  // 用户数据（实际应从API获取）
  const userData = {
    username: user?.username || '学习达人',
    phone: user?.phone ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '未登录',
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
        <Text style={styles.headerTitle}>个人中心</Text>
        <TouchableOpacity style={styles.settingsBtn}>
          <Ionicons name="settings-outline" size={24} color="#333" />
        </TouchableOpacity>
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
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>退出登录</Text>
      </TouchableOpacity>
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
});
