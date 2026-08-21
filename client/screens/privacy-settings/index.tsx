import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';

export default function PrivacySettingsScreen() {
  const [profileVisibility, setProfileVisibility] = useState('friends');
  const [showLearningStats, setShowLearningStats] = useState(true);
  const [allowFriendRequest, setAllowFriendRequest] = useState(true);
  const [shareData, setShareData] = useState(false);

  const visibilityOptions = [
    { label: '公开', value: 'public', desc: '所有人可见', icon: 'globe' },
    { label: '仅好友', value: 'friends', desc: '仅好友可见', icon: 'people' },
    { label: '私密', value: 'private', desc: '仅自己可见', icon: 'lock-closed' },
  ];

  return (
    <Screen>
      <Header title="隐私设置" />
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
        {/* 资料可见性 */}
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
            资料可见性
          </Text>
          <View style={{ gap: 8 }}>
            {visibilityOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                onPress={() => setProfileVisibility(option.value)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: profileVisibility === option.value ? '#eff6ff' : '#f9fafb',
                  borderWidth: profileVisibility === option.value ? 2 : 1,
                  borderColor: profileVisibility === option.value ? '#3b82f6' : '#e5e7eb',
                }}
              >
                <Ionicons
                  name={option.icon as any}
                  size={20}
                  color={profileVisibility === option.value ? '#3b82f6' : '#6b7280'}
                  style={{ marginRight: 12 }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      color: profileVisibility === option.value ? '#3b82f6' : '#1f2937',
                      fontWeight: profileVisibility === option.value ? '600' : '400',
                    }}
                  >
                    {option.label}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>
                    {option.desc}
                  </Text>
                </View>
                {profileVisibility === option.value && (
                  <Ionicons name="checkmark-circle" size={24} color="#3b82f6" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 隐私开关 */}
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
            onPress={() => setShowLearningStats(!showLearningStats)}
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
              <Ionicons name="stats-chart" size={20} color="#6b7280" style={{ marginRight: 12 }} />
              <View>
                <Text style={{ fontSize: 15, color: '#1f2937' }}>展示学习统计</Text>
                <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>
                  允许他人查看你的学习数据
                </Text>
              </View>
            </View>
            <View
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                backgroundColor: showLearningStats ? '#3b82f6' : '#e5e7eb',
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
                  marginLeft: showLearningStats ? 20 : 0,
                }}
              />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setAllowFriendRequest(!allowFriendRequest)}
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
              <Ionicons name="person-add" size={20} color="#6b7280" style={{ marginRight: 12 }} />
              <View>
                <Text style={{ fontSize: 15, color: '#1f2937' }}>允许好友申请</Text>
                <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>
                  接收其他人的好友请求
                </Text>
              </View>
            </View>
            <View
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                backgroundColor: allowFriendRequest ? '#3b82f6' : '#e5e7eb',
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
                  marginLeft: allowFriendRequest ? 20 : 0,
                }}
              />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShareData(!shareData)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="share-social" size={20} color="#6b7280" style={{ marginRight: 12 }} />
              <View>
                <Text style={{ fontSize: 15, color: '#1f2937' }}>分享学习数据</Text>
                <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>
                  匿名分享数据用于改进服务
                </Text>
              </View>
            </View>
            <View
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                backgroundColor: shareData ? '#3b82f6' : '#e5e7eb',
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
                  marginLeft: shareData ? 20 : 0,
                }}
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* 数据管理 */}
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
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: '#f3f4f6',
            }}
          >
            <Ionicons name="download" size={20} color="#6b7280" style={{ marginRight: 12 }} />
            <Text style={{ fontSize: 15, color: '#1f2937', flex: 1 }}>导出学习数据</Text>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16,
            }}
          >
            <Ionicons name="trash" size={20} color="#ef4444" style={{ marginRight: 12 }} />
            <Text style={{ fontSize: 15, color: '#ef4444', flex: 1 }}>删除学习数据</Text>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* 协议 */}
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: '#f3f4f6',
            }}
          >
            <Ionicons name="document-text" size={20} color="#6b7280" style={{ marginRight: 12 }} />
            <Text style={{ fontSize: 15, color: '#1f2937', flex: 1 }}>隐私政策</Text>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16,
            }}
          >
            <Ionicons name="shield-checkmark" size={20} color="#6b7280" style={{ marginRight: 12 }} />
            <Text style={{ fontSize: 15, color: '#1f2937', flex: 1 }}>用户协议</Text>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Screen>
  );
}
