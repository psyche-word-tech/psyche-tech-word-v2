import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { getApiBaseUrl } from '@/utils/apiConfig';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
  progress?: number;
  target?: number;
}

export default function AchievementsScreen() {
  const router = useSafeRouter();
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [unlockedCount, setUnlockedCount] = useState(0);

  useEffect(() => {
    loadAchievements();
  }, []);

  const loadAchievements = async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/achievements`, {
        headers: {
          'Authorization': `Bearer ${user?.token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setAchievements(data.data);
        setUnlockedCount(data.data.filter((a: Achievement) => a.unlocked).length);
      }
    } catch (error) {
      console.error('加载成就失败:', error);
      // 使用默认成就数据
      setAchievements(getDefaultAchievements());
    }
  };

  const getDefaultAchievements = (): Achievement[] => [
    { id: '1', title: '初次学习', description: '完成第一次学习', icon: '🎯', unlocked: true, unlockedAt: '2024-01-01' },
    { id: '2', title: '坚持一周', description: '连续学习 7 天', icon: '🔥', unlocked: true, unlockedAt: '2024-01-08' },
    { id: '3', title: '百词斩', description: '累计学习 100 个单词', icon: '💯', unlocked: true, unlockedAt: '2024-01-15' },
    { id: '4', title: '词汇达人', description: '累计学习 500 个单词', icon: '📚', unlocked: false, progress: 320, target: 500 },
    { id: '5', title: '词汇大师', description: '累计学习 1000 个单词', icon: '🎓', unlocked: false, progress: 320, target: 1000 },
    { id: '6', title: '月度坚持', description: '连续学习 30 天', icon: '', unlocked: false, progress: 15, target: 30 },
    { id: '7', title: '完美复习', description: '连续 10 次复习正确率 100%', icon: '⭐', unlocked: false },
    { id: '8', title: '学习之星', description: '单日学习 100 个单词', icon: '', unlocked: false, progress: 65, target: 100 },
  ];

  return (
    <Screen title="我的成就">
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
        {/* 成就统计 */}
        <View className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl p-6 mb-6 shadow-sm">
          <Text className="text-white text-lg font-bold mb-2">成就徽章</Text>
          <View className="flex-row items-end">
            <Text className="text-white text-5xl font-bold">{unlockedCount}</Text>
            <Text className="text-white/80 text-lg ml-2 mb-1">/ {achievements.length}</Text>
          </View>
          <Text className="text-white/80 text-sm mt-2">已解锁成就</Text>
        </View>

        {/* 成就列表 */}
        <Text className="text-lg font-bold text-gray-900 mb-4">成就列表</Text>
        {achievements.map((achievement) => (
          <View 
            key={achievement.id}
            className={`bg-white rounded-2xl p-4 mb-3 shadow-sm ${!achievement.unlocked ? 'opacity-60' : ''}`}
          >
            <View className="flex-row items-center">
              <View className={`w-16 h-16 rounded-full items-center justify-center mr-4 ${
                achievement.unlocked ? 'bg-yellow-100' : 'bg-gray-100'
              }`}>
                <Text className="text-3xl">{achievement.icon}</Text>
              </View>
              <View className="flex-1">
                <View className="flex-row items-center mb-1">
                  <Text className="text-lg font-bold text-gray-900">{achievement.title}</Text>
                  {achievement.unlocked && (
                    <Ionicons name="checkmark-circle" size={20} color="#10b981" className="ml-2" />
                  )}
                </View>
                <Text className="text-sm text-gray-500 mb-2">{achievement.description}</Text>
                {!achievement.unlocked && achievement.progress !== undefined && achievement.target && (
                  <View>
                    <View className="flex-row justify-between mb-1">
                      <Text className="text-xs text-gray-500">进度</Text>
                      <Text className="text-xs font-bold text-gray-700">{achievement.progress}/{achievement.target}</Text>
                    </View>
                    <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <View 
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${(achievement.progress / achievement.target) * 100}%` }}
                      />
                    </View>
                  </View>
                )}
                {achievement.unlocked && achievement.unlockedAt && (
                  <Text className="text-xs text-green-600">
                    解锁于 {achievement.unlockedAt}
                  </Text>
                )}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}
