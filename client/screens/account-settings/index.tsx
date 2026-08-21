import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { getApiBaseUrl } from '@/utils/apiConfig';

export default function AccountSettingsScreen() {
  const router = useSafeRouter();
  const { user, logout } = useAuth();

  const handleChangePassword = () => {
    router.push('/change-password');
  };

  const handleChangePhone = () => {
    router.push('/change-phone');
  };

  const handleNotificationSettings = () => {
    router.push('/notification-settings');
  };

  const handleDataBackup = () => {
    router.push('/data-backup');
  };

  const handleDeleteAccount = () => {
    router.push('/delete-account');
  };

  const menuItems = [
    {
      icon: 'lock-closed',
      title: '修改密码',
      subtitle: '定期修改密码保护账号安全',
      onPress: handleChangePassword,
    },
    {
      icon: 'phone-portrait',
      title: '修改手机号',
      subtitle: user?.phone || '未绑定',
      onPress: handleChangePhone,
    },
    {
      icon: 'notifications',
      title: '消息通知',
      subtitle: '管理推送通知设置',
      onPress: handleNotificationSettings,
    },
    {
      icon: 'cloud-upload',
      title: '数据备份',
      subtitle: '自动备份学习数据',
      onPress: handleDataBackup,
    },
  ];

  return (
    <Screen>
      <Header title="账号管理" />
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
        {/* 账号信息 */}
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: '#e5e7eb',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Ionicons name="person" size={28} color="#6b7280" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937' }}>
                {user?.username || '用户'}
              </Text>
              <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                {user?.phone || '未绑定手机号'}
              </Text>
            </View>
          </View>
        </View>

        {/* 功能菜单 */}
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            overflow: 'hidden',
            marginBottom: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              onPress={item.onPress}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                borderBottomWidth: index < menuItems.length - 1 ? 1 : 0,
                borderBottomColor: '#f3f4f6',
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: '#f3f4f6',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Ionicons name={item.icon as any} size={20} color="#4b5563" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, color: '#1f2937' }}>{item.title}</Text>
                <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>
          ))}
        </View>

        {/* 危险操作 */}
        <TouchableOpacity
          onPress={handleDeleteAccount}
          style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: '#fee2e2',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Ionicons name="trash" size={20} color="#ef4444" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, color: '#ef4444', fontWeight: '500' }}>注销账号</Text>
            <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>
              永久删除账号及所有数据
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </TouchableOpacity>
      </ScrollView>
    </Screen>
  );
}
