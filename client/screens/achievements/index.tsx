import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { getApiBaseUrl } from '@/utils/apiConfig';
import { useAuth } from '@/contexts/AuthContext';

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
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAchievements();
  }, []);

  const loadAchievements = async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/user/achievements`, {
        headers: {
          'Authorization': `Bearer ${user?.token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setAchievements(data.achievements || []);
      }
    } catch (error) {
      console.error('加载成就失败:', error);
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

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return (
    <Screen>
      <Header title="我的成就" />
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
        {/* 成就概览 */}
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            padding: 20,
            marginBottom: 16,
            alignItems: 'center',
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
              borderRadius: 40,
              backgroundColor: '#fef3c7',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <Ionicons name="trophy" size={40} color="#f59e0b" />
          </View>
          <Text style={{ fontSize: 24, fontWeight: '700', color: '#1f2937', marginBottom: 4 }}>
            {unlockedCount}
          </Text>
          <Text style={{ fontSize: 14, color: '#6b7280' }}>已解锁成就</Text>
        </View>

        {/* 成就列表 */}
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 12 }}>
          全部成就
        </Text>
        
        {achievements.length === 0 ? (
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 12,
              padding: 40,
              alignItems: 'center',
            }}
          >
            <Ionicons name="medal-outline" size={48} color="#e5e7eb" />
            <Text style={{ fontSize: 14, color: '#9ca3af', marginTop: 12 }}>
              暂无成就数据
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {achievements.map((achievement) => (
              <View
                key={achievement.id}
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 12,
                  padding: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  opacity: achievement.unlocked ? 1 : 0.6,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: achievement.unlocked ? '#fef3c7' : '#f3f4f6',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <Ionicons
                    name={achievement.icon as any}
                    size={24}
                    color={achievement.unlocked ? '#f59e0b' : '#9ca3af'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '600',
                      color: '#1f2937',
                      marginBottom: 4,
                    }}
                  >
                    {achievement.title}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#6b7280' }}>
                    {achievement.description}
                  </Text>
                  {achievement.progress !== undefined && achievement.target && (
                    <View style={{ marginTop: 8 }}>
                      <View style={{ height: 4, backgroundColor: '#e5e7eb', borderRadius: 2 }}>
                        <View
                          style={{
                            width: `${(achievement.progress / achievement.target) * 100}%`,
                            height: '100%',
                            backgroundColor: '#f59e0b',
                            borderRadius: 2,
                          }}
                        />
                      </View>
                      <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                        {achievement.progress}/{achievement.target}
                      </Text>
                    </View>
                  )}
                </View>
                {achievement.unlocked && (
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      backgroundColor: '#fef3c7',
                      borderRadius: 12,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: '#f59e0b', fontWeight: '600' }}>
                      已解锁
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
