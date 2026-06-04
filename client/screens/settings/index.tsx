import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert } from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useState } from 'react';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';

export default function SettingsScreen() {
  const router = useSafeRouter();
  const { logout } = useAuth();
  const [elderMode, setElderMode] = useState(false);

  const handleLogout = () => {
    logout().then(() => {
      router.replace('/login');
    }).catch((error) => {
      console.error('退出登录失败:', error);
      Alert.alert('错误', '退出登录失败，请重试');
    });
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
          <TouchableOpacity 
            style={styles.logoutButton}
            activeOpacity={0.8}
            onPress={handleLogout}
          >
            <Text style={styles.logoutText}>退出登录</Text>
          </TouchableOpacity>
        </View>
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
});
