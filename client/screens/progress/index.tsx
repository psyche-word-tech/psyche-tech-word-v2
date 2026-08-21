import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { getApiBaseUrl } from '@/utils/apiConfig';

export default function ProgressScreen() {
  const router = useSafeRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalWords: 0,
    masteredWords: 0,
    learningWords: 0,
    studyDays: 0,
    streakDays: 0,
    todayWords: 0,
    weekWords: 0,
    monthWords: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/progress/stats`, {
        headers: {
          'Authorization': `Bearer ${user?.token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('加载学习进度失败:', error);
    }
  };

  const masteryRate = stats.totalWords > 0 ? Math.round((stats.masteredWords / stats.totalWords) * 100) : 0;

  return (
    <Screen title="学习进度">
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
        {/* 总体进度 */}
        <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
          <Text className="text-lg font-bold text-gray-900 mb-4">总体进度</Text>
          <View className="mb-4">
            <View className="flex-row justify-between mb-2">
              <Text className="text-gray-600">掌握率</Text>
              <Text className="font-bold text-green-600">{masteryRate}%</Text>
            </View>
            <View className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <View 
                className="h-full bg-green-500 rounded-full"
                style={{ width: `${masteryRate}%` }}
              />
            </View>
          </View>
          <View className="flex-row justify-between">
            <View className="items-center">
              <Text className="text-2xl font-bold text-gray-900">{stats.totalWords}</Text>
              <Text className="text-sm text-gray-500">总词汇</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-green-600">{stats.masteredWords}</Text>
              <Text className="text-sm text-gray-500">已掌握</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-blue-600">{stats.learningWords}</Text>
              <Text className="text-sm text-gray-500">学习中</Text>
            </View>
          </View>
        </View>

        {/* 学习天数 */}
        <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
          <Text className="text-lg font-bold text-gray-900 mb-4">学习天数</Text>
          <View className="flex-row justify-between">
            <View className="items-center flex-1">
              <Text className="text-3xl font-bold text-orange-500">{stats.studyDays}</Text>
              <Text className="text-sm text-gray-500 mt-1">累计学习</Text>
            </View>
            <View className="items-center flex-1">
              <Text className="text-3xl font-bold text-red-500">{stats.streakDays}</Text>
              <Text className="text-sm text-gray-500 mt-1">连续天数</Text>
            </View>
          </View>
        </View>

        {/* 学习统计 */}
        <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
          <Text className="text-lg font-bold text-gray-900 mb-4">学习统计</Text>
          <View className="space-y-4">
            <View className="flex-row justify-between items-center py-2 border-b border-gray-100">
              <Text className="text-gray-600">今日学习</Text>
              <Text className="font-bold text-gray-900">{stats.todayWords} 词</Text>
            </View>
            <View className="flex-row justify-between items-center py-2 border-b border-gray-100">
              <Text className="text-gray-600">本周学习</Text>
              <Text className="font-bold text-gray-900">{stats.weekWords} 词</Text>
            </View>
            <View className="flex-row justify-between items-center py-2">
              <Text className="text-gray-600">本月学习</Text>
              <Text className="font-bold text-gray-900">{stats.monthWords} 词</Text>
            </View>
          </View>
        </View>

        {/* 学习建议 */}
        <View className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl p-6 shadow-sm">
          <Text className="text-lg font-bold text-white mb-2">学习建议</Text>
          <Text className="text-white/90 text-sm">
            {masteryRate < 30 ? '继续加油！建议每天学习 20-30 个新单词，保持学习节奏。' :
             masteryRate < 60 ? ' progress 不错！建议复习已学单词，巩固记忆。' :
             masteryRate < 80 ? '表现优秀！可以尝试挑战更高难度的词汇。' :
             '太棒了！你已经掌握了大部分词汇，建议定期复习保持记忆。'}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
