import { View, Text, ScrollView, Switch, Alert } from 'react-native';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import { getApiBaseUrl } from '@/utils/apiConfig';
import { useState, useEffect } from 'react';

export default function NotificationSettingsScreen() {
  const router = useSafeRouter();
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    pushEnabled: true,
    studyReminder: true,
    achievementNotification: true,
    systemNotification: true,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.token) {
      loadSettings();
    }
  }, [user?.token]);

  const loadSettings = async () => {
    if (!user?.token) return;
    
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/user/notification-settings`, {
        headers: {
          'Authorization': `Bearer ${user.token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('加载通知设置失败:', error);
    }
  };

  const handleToggle = async (key: string, value: boolean) => {
    if (!user?.token) {
      Alert.alert('提示', '请先登录');
      return;
    }
    
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    setLoading(true);

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/user/notification-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          userId: user.id,
          settings: newSettings,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        setSettings(settings);
        Alert.alert('错误', '设置更新失败');
      }
    } catch (error) {
      setSettings(settings);
      Alert.alert('错误', '网络错误');
    } finally {
      setLoading(false);
    }
  };

  const items = [
    { key: 'pushEnabled', title: '推送通知', desc: '接收学习提醒和系统通知' },
    { key: 'studyReminder', title: '学习提醒', desc: '每日学习时间提醒' },
    { key: 'achievementNotification', title: '成就通知', desc: '获得成就时通知' },
    { key: 'systemNotification', title: '系统通知', desc: '系统更新和维护通知' },
  ];

  return (
    <Screen>
      <Header title="消息通知" />
      <ScrollView style={{ flex: 1, backgroundColor: '#f5f5f5' }} contentContainerStyle={{ padding: 16 }}>
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {items.map((item, index) => (
            <View
              key={item.key}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 16,
                borderBottomWidth: index < items.length - 1 ? 1 : 0,
                borderBottomColor: '#f0f0f0',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, color: '#333', marginBottom: 4 }}>{item.title}</Text>
                <Text style={{ fontSize: 12, color: '#999' }}>{item.desc}</Text>
              </View>
              <Switch
                value={settings[item.key as keyof typeof settings]}
                onValueChange={(value) => handleToggle(item.key, value)}
                disabled={loading}
              />
            </View>
          ))}
        </View>

        <Text style={{ fontSize: 12, color: '#999', textAlign: 'center', marginTop: 16 }}>
          关闭推送通知后，将不会收到任何学习提醒
        </Text>
      </ScrollView>
    </Screen>
  );
}
