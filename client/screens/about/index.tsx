import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Ionicons } from '@expo/vector-icons';

export default function AboutScreen() {
  const router = useSafeRouter();

  const handleCheckUpdate = () => {
    alert('当前已是最新版本');
  };

  const handleOpenWebsite = () => {
    Linking.openURL('https://www.example.com');
  };

  const handleContactUs = () => {
    Linking.openURL('mailto:support@example.com');
  };

  const handleFeedback = () => {
    alert('反馈功能开发中');
  };

  return (
    <Screen title="关于我们">
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
        {/* 应用信息 */}
        <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm items-center">
          <View className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl items-center justify-center mb-4">
            <Text className="text-white text-3xl font-bold">单</Text>
          </View>
          <Text className="text-xl font-bold text-gray-900">单词学习</Text>
          <Text className="text-gray-500 mt-2">版本 1.0.0</Text>
          <Text className="text-gray-400 text-sm mt-1">让学习更简单</Text>
        </View>

        {/* 应用介绍 */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <Text className="text-lg font-bold text-gray-900 mb-3">应用介绍</Text>
          <Text className="text-gray-600 leading-relaxed">
            单词学习是一款专业的英语学习应用，采用科学的记忆算法，帮助您高效记忆单词。
            应用提供丰富的学习模式，包括学习、复习、测试等，让您的学习过程更加有趣和高效。
          </Text>
        </View>

        {/* 功能列表 */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <Text className="text-lg font-bold text-gray-900 mb-4">主要功能</Text>
          
          <View className="space-y-3">
            <View className="flex-row items-center">
              <View className="w-8 h-8 bg-blue-100 rounded-full items-center justify-center mr-3">
                <Ionicons name="book" size={18} color="#3b82f6" />
              </View>
              <Text className="text-gray-700 flex-1">科学记忆算法</Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-8 h-8 bg-green-100 rounded-full items-center justify-center mr-3">
                <Ionicons name="stats-chart" size={18} color="#10b981" />
              </View>
              <Text className="text-gray-700 flex-1">学习进度追踪</Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-8 h-8 bg-purple-100 rounded-full items-center justify-center mr-3">
                <Ionicons name="trophy" size={18} color="#8b5cf6" />
              </View>
              <Text className="text-gray-700 flex-1">成就系统</Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-8 h-8 bg-orange-100 rounded-full items-center justify-center mr-3">
                <Ionicons name="eye" size={18} color="#f97316" />
              </View>
              <Text className="text-gray-700 flex-1">虹膜识别监测</Text>
            </View>
          </View>
        </View>

        {/* 其他信息 */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <Text className="text-lg font-bold text-gray-900 mb-4">其他信息</Text>
          
          <TouchableOpacity 
            className="flex-row items-center justify-between p-4 bg-gray-50 rounded-xl mb-2"
            onPress={handleCheckUpdate}
          >
            <View className="flex-row items-center">
              <Ionicons name="refresh" size={24} color="#6b7280" />
              <Text className="text-gray-700 ml-3">检查更新</Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-gray-500 mr-2">当前已是最新</Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            className="flex-row items-center justify-between p-4 bg-gray-50 rounded-xl mb-2"
            onPress={handleOpenWebsite}
          >
            <View className="flex-row items-center">
              <Ionicons name="globe" size={24} color="#6b7280" />
              <Text className="text-gray-700 ml-3">官方网站</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity 
            className="flex-row items-center justify-between p-4 bg-gray-50 rounded-xl mb-2"
            onPress={handleContactUs}
          >
            <View className="flex-row items-center">
              <Ionicons name="mail" size={24} color="#6b7280" />
              <Text className="text-gray-700 ml-3">联系我们</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity 
            className="flex-row items-center justify-between p-4 bg-gray-50 rounded-xl"
            onPress={handleFeedback}
          >
            <View className="flex-row items-center">
              <Ionicons name="chatbubble" size={24} color="#6b7280" />
              <Text className="text-gray-700 ml-3">意见反馈</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* 版权信息 */}
        <View className="items-center py-4">
          <Text className="text-gray-400 text-sm">© 2024 单词学习</Text>
          <Text className="text-gray-400 text-sm mt-1">保留所有权利</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
