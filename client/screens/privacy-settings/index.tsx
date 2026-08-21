import { View, Text, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { getApiBaseUrl } from '@/utils/apiConfig';
import { useAuth } from '@/contexts/AuthContext';

export default function PrivacySettingsScreen() {
  const router = useSafeRouter();
  const { user } = useAuth();
  const [profileVisibility, setProfileVisibility] = useState('friends');
  const [showLearningStats, setShowLearningStats] = useState(true);
  const [allowFriendRequest, setAllowFriendRequest] = useState(true);
  const [shareData, setShareData] = useState(false);

  const visibilityOptions = [
    { label: '公开', value: 'public', desc: '所有人可见' },
    { label: '仅好友', value: 'friends', desc: '仅好友可见' },
    { label: '私密', value: 'private', desc: '仅自己可见' },
  ];

  const handleExportData = () => {
    Alert.alert(
      '导出数据',
      '确定要导出您的学习数据吗？数据将以 JSON 格式下载。',
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '确定导出',
          onPress: async () => {
            try {
              const response = await fetch(`${getApiBaseUrl()}/api/v1/user/export-data`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${user?.token}`,
                },
              });
              if (response.ok) {
                const data = await response.json();
                // 在实际应用中，这里会触发文件下载
                Alert.alert('成功', '数据导出成功');
              } else {
                Alert.alert('错误', '数据导出失败');
              }
            } catch (error) {
              Alert.alert('错误', '网络错误，请稍后重试');
            }
          }
        },
      ]
    );
  };

  const handleDeleteData = () => {
    Alert.alert(
      '删除数据',
      '确定要删除您的学习数据吗？此操作不可恢复。',
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '确定删除',
          style: 'destructive',
          onPress: () => {
            Alert.alert('提示', '数据删除功能开发中');
          }
        },
      ]
    );
  };

  return (
    <Screen title="隐私设置">
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
        {/* 资料可见性 */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <Text className="text-lg font-bold text-gray-900 mb-4">资料可见性</Text>
          
          {visibilityOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              className={`flex-row items-center justify-between p-4 rounded-xl mb-2 ${
                profileVisibility === option.value ? 'bg-blue-50 border-2 border-blue-500' : 'bg-gray-50'
              }`}
              onPress={() => setProfileVisibility(option.value)}
            >
              <View>
                <Text className={`font-medium ${
                  profileVisibility === option.value ? 'text-blue-600' : 'text-gray-900'
                }`}>
                  {option.label}
                </Text>
                <Text className="text-sm text-gray-500 mt-1">{option.desc}</Text>
              </View>
              {profileVisibility === option.value && (
                <Ionicons name="checkmark-circle" size={24} color="#3b82f6" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* 隐私开关 */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <Text className="text-lg font-bold text-gray-900 mb-4">隐私开关</Text>
          
          <View className="flex-row items-center justify-between py-3 border-b border-gray-100">
            <View className="flex-row items-center">
              <Ionicons name="stats-chart" size={24} color="#6b7280" />
              <Text className="text-gray-700 ml-3">展示学习统计</Text>
            </View>
            <Switch
              value={showLearningStats}
              onValueChange={setShowLearningStats}
              trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
              thumbColor={showLearningStats ? '#3b82f6' : '#f4f3f4'}
            />
          </View>

          <View className="flex-row items-center justify-between py-3 border-b border-gray-100">
            <View className="flex-row items-center">
              <Ionicons name="person-add" size={24} color="#6b7280" />
              <Text className="text-gray-700 ml-3">允许好友申请</Text>
            </View>
            <Switch
              value={allowFriendRequest}
              onValueChange={setAllowFriendRequest}
              trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
              thumbColor={allowFriendRequest ? '#3b82f6' : '#f4f3f4'}
            />
          </View>

          <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center">
              <Ionicons name="share-social" size={24} color="#6b7280" />
              <Text className="text-gray-700 ml-3">分享学习数据</Text>
            </View>
            <Switch
              value={shareData}
              onValueChange={setShareData}
              trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
              thumbColor={shareData ? '#3b82f6' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* 数据管理 */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <Text className="text-lg font-bold text-gray-900 mb-4">数据管理</Text>
          
          <TouchableOpacity 
            className="flex-row items-center justify-between p-4 bg-gray-50 rounded-xl mb-2"
            onPress={handleExportData}
          >
            <View className="flex-row items-center">
              <Ionicons name="download" size={24} color="#6b7280" />
              <Text className="text-gray-700 ml-3">导出学习数据</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity 
            className="flex-row items-center justify-between p-4 bg-red-50 rounded-xl"
            onPress={handleDeleteData}
          >
            <View className="flex-row items-center">
              <Ionicons name="trash" size={24} color="#ef4444" />
              <Text className="text-red-600 ml-3">删除学习数据</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* 隐私协议 */}
        <View className="bg-white rounded-2xl p-4 shadow-sm">
          <Text className="text-lg font-bold text-gray-900 mb-4">隐私协议</Text>
          
          <TouchableOpacity className="flex-row items-center justify-between p-4 bg-gray-50 rounded-xl mb-2">
            <View className="flex-row items-center">
              <Ionicons name="document-text" size={24} color="#6b7280" />
              <Text className="text-gray-700 ml-3">隐私政策</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center justify-between p-4 bg-gray-50 rounded-xl">
            <View className="flex-row items-center">
              <Ionicons name="shield-checkmark" size={24} color="#6b7280" />
              <Text className="text-gray-700 ml-3">用户协议</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Screen>
  );
}
