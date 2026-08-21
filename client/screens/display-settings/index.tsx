import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { getApiBaseUrl } from '@/utils/apiConfig';

interface DisplaySettings {
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  theme: 'system' | 'light' | 'dark';
  autoPlayAudio: boolean;
  showPhonetic: boolean;
  showExample: boolean;
}

export default function DisplaySettingsScreen() {
  const [settings, setSettings] = useState<DisplaySettings>({
    fontSize: 'medium',
    theme: 'system',
    autoPlayAudio: true,
    showPhonetic: true,
    showExample: true,
  });
  const [loading, setLoading] = useState(true);

  const apiBaseUrl = getApiBaseUrl();

  // 加载设置
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const token = await import('@/utils/auth').then(m => m.getToken());
      const response = await fetch(`${apiBaseUrl}/api/v1/settings/display`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const result = await response.json();
      if (result.success) {
        setSettings({ ...settings, ...result.data });
      }
    } catch (error) {
      console.error('加载显示设置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 保存设置
  const saveSettings = async (newSettings: Partial<DisplaySettings>) => {
    try {
      const token = await import('@/utils/auth').then(m => m.getToken());
      const response = await fetch(`${apiBaseUrl}/api/v1/settings/display`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ ...settings, ...newSettings }),
      });
      const result = await response.json();
      if (result.success) {
        setSettings({ ...settings, ...newSettings });
      }
    } catch (error) {
      console.error('保存显示设置失败:', error);
      Alert.alert('错误', '保存设置失败');
    }
  };

  const fontSizes = [
    { label: '小', value: 'small' as const, size: 14 },
    { label: '中', value: 'medium' as const, size: 16 },
    { label: '大', value: 'large' as const, size: 18 },
    { label: '超大', value: 'xlarge' as const, size: 20 },
  ];

  const themes = [
    { label: '跟随系统', value: 'system' as const, icon: 'phone-portrait' },
    { label: '浅色模式', value: 'light' as const, icon: 'sunny' },
    { label: '深色模式', value: 'dark' as const, icon: 'moon' },
  ];

  return (
    <Screen>
      <Header title="显示设置" />
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
        {/* 字体大小 */}
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
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#1f2937', marginBottom: 16 }}>
            字体大小
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {fontSizes.map((item) => (
              <TouchableOpacity
                key={item.value}
                onPress={() => saveSettings({ fontSize: item.value })}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 8,
                  backgroundColor: settings.fontSize === item.value ? '#3b82f6' : '#f3f4f6',
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: item.size,
                    color: settings.fontSize === item.value ? '#fff' : '#4b5563',
                    fontWeight: settings.fontSize === item.value ? '600' : '400',
                  }}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 主题模式 */}
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
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#1f2937', marginBottom: 16 }}>
            主题模式
          </Text>
          <View style={{ gap: 8 }}>
            {themes.map((item) => (
              <TouchableOpacity
                key={item.value}
                onPress={() => saveSettings({ theme: item.value })}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: settings.theme === item.value ? '#eff6ff' : '#f9fafb',
                  borderWidth: settings.theme === item.value ? 2 : 1,
                  borderColor: settings.theme === item.value ? '#3b82f6' : '#e5e7eb',
                }}
              >
                <Ionicons
                  name={item.icon as any}
                  size={20}
                  color={settings.theme === item.value ? '#3b82f6' : '#6b7280'}
                  style={{ marginRight: 12 }}
                />
                <Text
                  style={{
                    fontSize: 15,
                    color: settings.theme === item.value ? '#3b82f6' : '#4b5563',
                    fontWeight: settings.theme === item.value ? '600' : '400',
                  }}
                >
                  {item.label}
                </Text>
                {settings.theme === item.value && (
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color="#3b82f6"
                    style={{ marginLeft: 'auto' }}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 显示选项 */}
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
          <TouchableOpacity
            onPress={() => saveSettings({ autoPlayAudio: !settings.autoPlayAudio })}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: '#f3f4f6',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="volume-high" size={20} color="#6b7280" style={{ marginRight: 12 }} />
              <Text style={{ fontSize: 15, color: '#1f2937' }}>自动播放发音</Text>
            </View>
            <View
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                backgroundColor: settings.autoPlayAudio ? '#3b82f6' : '#e5e7eb',
                justifyContent: 'center',
                paddingHorizontal: 2,
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: '#fff',
                  marginLeft: settings.autoPlayAudio ? 20 : 0,
                }}
              />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => saveSettings({ showPhonetic: !settings.showPhonetic })}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: '#f3f4f6',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="text" size={20} color="#6b7280" style={{ marginRight: 12 }} />
              <Text style={{ fontSize: 15, color: '#1f2937' }}>显示音标</Text>
            </View>
            <View
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                backgroundColor: settings.showPhonetic ? '#3b82f6' : '#e5e7eb',
                justifyContent: 'center',
                paddingHorizontal: 2,
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: '#fff',
                  marginLeft: settings.showPhonetic ? 20 : 0,
                }}
              />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => saveSettings({ showExample: !settings.showExample })}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="list" size={20} color="#6b7280" style={{ marginRight: 12 }} />
              <Text style={{ fontSize: 15, color: '#1f2937' }}>显示例句</Text>
            </View>
            <View
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                backgroundColor: settings.showExample ? '#3b82f6' : '#e5e7eb',
                justifyContent: 'center',
                paddingHorizontal: 2,
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: '#fff',
                  marginLeft: settings.showExample ? 20 : 0,
                }}
              />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Screen>
  );
}
