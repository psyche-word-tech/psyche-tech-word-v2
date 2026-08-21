import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Ionicons } from '@expo/vector-icons';

export default function AboutScreen() {
  const appVersion = '1.0.0';

  const menuItems = [
    {
      icon: 'document-text',
      title: '用户协议',
      onPress: () => Linking.openURL('https://example.com/terms'),
    },
    {
      icon: 'shield-checkmark',
      title: '隐私政策',
      onPress: () => Linking.openURL('https://example.com/privacy'),
    },
    {
      icon: 'help-circle',
      title: '帮助中心',
      onPress: () => Linking.openURL('https://example.com/help'),
    },
    {
      icon: 'chatbubble-ellipses',
      title: '意见反馈',
      onPress: () => Linking.openURL('mailto:feedback@example.com'),
    },
    {
      icon: 'share-social',
      title: '分享给朋友',
      onPress: () => {
        // 在实际应用中，这里会调用分享功能
        alert('分享功能开发中');
      },
    },
    {
      icon: 'star',
      title: '给我们评分',
      onPress: () => {
        // 在实际应用中，这里会打开应用商店评分页面
        alert('评分功能开发中');
      },
    },
  ];

  return (
    <Screen>
      <Header title="关于我们" />
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
        {/* App 信息 */}
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            padding: 24,
            alignItems: 'center',
            marginBottom: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              backgroundColor: '#3b82f6',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Ionicons name="book" size={40} color="#fff" />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#1f2937', marginBottom: 4 }}>
            单词 Voyage
          </Text>
          <Text style={{ fontSize: 14, color: '#6b7280' }}>版本 {appVersion}</Text>
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
              <Text style={{ fontSize: 15, color: '#1f2937', flex: 1 }}>{item.title}</Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>
          ))}
        </View>

        {/* 联系信息 */}
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            padding: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#1f2937', marginBottom: 12 }}>
            联系我们
          </Text>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="mail" size={18} color="#6b7280" style={{ marginRight: 8 }} />
              <Text style={{ fontSize: 14, color: '#6b7280' }}>support@example.com</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="globe" size={18} color="#6b7280" style={{ marginRight: 8 }} />
              <Text style={{ fontSize: 14, color: '#6b7280' }}>www.example.com</Text>
            </View>
          </View>
        </View>

        {/* 版权信息 */}
        <Text style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 24 }}>
          © 2024 单词 Voyage. All rights reserved.
        </Text>
      </ScrollView>
    </Screen>
  );
}
