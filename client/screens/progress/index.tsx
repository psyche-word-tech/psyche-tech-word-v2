import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { getApiBaseUrl } from '@/utils/apiConfig';
import { useAuth } from '@/contexts/AuthContext';

interface ProgressData {
  totalWords: number;
  learnedWords: number;
  masteredWords: number;
  learningDays: number;
  dailyAverage: number;
  streak: number;
}

export default function ProgressScreen() {
  const router = useSafeRouter();
  const { user } = useAuth();
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/user/progress`, {
        headers: {
          'Authorization': `Bearer ${user?.token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setProgress(data);
      }
    } catch (error) {
      console.error('加载学习进度失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, color: '#666' }}>加载中...</Text>
        </View>
      </Screen>
    );
  }

  const stats = [
    { label: '学习天数', value: progress?.learningDays || 0, icon: 'calendar', color: '#3b82f6' },
    { label: '已学单词', value: progress?.learnedWords || 0, icon: 'book', color: '#10b981' },
    { label: '已掌握', value: progress?.masteredWords || 0, icon: 'checkmark-circle', color: '#f59e0b' },
    { label: '连续学习', value: `${progress?.streak || 0}天`, icon: 'flame', color: '#ef4444' },
  ];

  return (
    <Screen>
      <Header title="学习进度" />
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
        {/* 统计卡片 */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          {stats.map((stat, index) => (
            <View
              key={index}
              style={{
                width: '48%',
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
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: `${stat.color}20`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 8,
                  }}
                >
                  <Ionicons name={stat.icon as any} size={18} color={stat.color} />
                </View>
                <Text style={{ fontSize: 13, color: '#6b7280' }}>{stat.label}</Text>
              </View>
              <Text style={{ fontSize: 24, fontWeight: '700', color: '#1f2937' }}>
                {stat.value}
              </Text>
            </View>
          ))}
        </View>

        {/* 学习趋势 */}
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
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 16 }}>
            学习趋势
          </Text>
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Ionicons name="stats-chart" size={48} color="#e5e7eb" />
            <Text style={{ fontSize: 14, color: '#9ca3af', marginTop: 12 }}>
              学习趋势图表开发中
            </Text>
          </View>
        </View>

        {/* 每日目标 */}
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
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 16 }}>
            每日目标
          </Text>
          <View style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 14, color: '#6b7280' }}>今日学习</Text>
              <Text style={{ fontSize: 14, color: '#3b82f6', fontWeight: '600' }}>
                {progress?.dailyAverage || 0} / 50 词
              </Text>
            </View>
            <View style={{ height: 8, backgroundColor: '#e5e7eb', borderRadius: 4 }}>
              <View
                style={{
                  width: `${Math.min(((progress?.dailyAverage || 0) / 50) * 100, 100)}%`,
                  height: '100%',
                  backgroundColor: '#3b82f6',
                  borderRadius: 4,
                }}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
