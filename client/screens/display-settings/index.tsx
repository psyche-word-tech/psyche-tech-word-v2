import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';

export default function DisplaySettingsScreen() {
  const [fontSize, setFontSize] = useState('medium');
  const [theme, setTheme] = useState('system');
  const [autoPlayAudio, setAutoPlayAudio] = useState(true);
  const [showPhonetic, setShowPhonetic] = useState(true);
  const [showExample, setShowExample] = useState(true);

  const fontSizes = [
    { label: '小', value: 'small', size: 14 },
    { label: '中', value: 'medium', size: 16 },
    { label: '大', value: 'large', size: 18 },
    { label: '超大', value: 'xlarge', size: 20 },
  ];

  const themes = [
    { label: '跟随系统', value: 'system', icon: 'phone-portrait' },
    { label: '浅色模式', value: 'light', icon: 'sunny' },
    { label: '深色模式', value: 'dark', icon: 'moon' },
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
                onPress={() => setFontSize(item.value)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 8,
                  backgroundColor: fontSize === item.value ? '#3b82f6' : '#f3f4f6',
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: item.size,
                    color: fontSize === item.value ? '#fff' : '#4b5563',
                    fontWeight: fontSize === item.value ? '600' : '400',
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
                onPress={() => setTheme(item.value)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: theme === item.value ? '#eff6ff' : '#f9fafb',
                  borderWidth: theme === item.value ? 2 : 1,
                  borderColor: theme === item.value ? '#3b82f6' : '#e5e7eb',
                }}
              >
                <Ionicons
                  name={item.icon as any}
                  size={20}
                  color={theme === item.value ? '#3b82f6' : '#6b7280'}
                  style={{ marginRight: 12 }}
                />
                <Text
                  style={{
                    fontSize: 15,
                    color: theme === item.value ? '#3b82f6' : '#4b5563',
                    fontWeight: theme === item.value ? '600' : '400',
                  }}
                >
                  {item.label}
                </Text>
                {theme === item.value && (
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
            onPress={() => setAutoPlayAudio(!autoPlayAudio)}
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
                backgroundColor: autoPlayAudio ? '#3b82f6' : '#e5e7eb',
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
                  marginLeft: autoPlayAudio ? 20 : 0,
                }}
              />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowPhonetic(!showPhonetic)}
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
                backgroundColor: showPhonetic ? '#3b82f6' : '#e5e7eb',
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
                  marginLeft: showPhonetic ? 20 : 0,
                }}
              />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowExample(!showExample)}
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
                backgroundColor: showExample ? '#3b82f6' : '#e5e7eb',
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
                  marginLeft: showExample ? 20 : 0,
                }}
              />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Screen>
  );
}
