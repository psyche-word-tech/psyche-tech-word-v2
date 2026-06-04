import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { FontAwesome6 } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';

interface DaySegment {
  day: string;
  known: number;
  vague: number;
  unknown: number;
}

interface StatsData {
  learning: number;
  known: number;
  vague: number;
  unknown: number;
}

function getLast7Days(): DaySegment[] {
  const days: DaySegment[] = [];
  const weekLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const month = d.getMonth() + 1;
    const date = d.getDate();
    const weekLabel = weekLabels[d.getDay()];
    days.push({
      day: `${month}/${date}`,
      known: i === 0 ? 0 : Math.floor(Math.random() * 15) + 1,
      vague: i === 0 ? 0 : Math.floor(Math.random() * 5) + 1,
      unknown: i === 0 ? 0 : Math.floor(Math.random() * 4) + 1,
    });
  }
  return days;
}

// 生成最近7天的数据，最后一天（今天）用真实数据覆盖
const mockSegments: DaySegment[] = getLast7Days();

const MAX_VALUE = 25;
import { API_BASE_URL } from '@/utils/apiConfig';
import { fetchWithRetry } from '@/utils/apiClient';

type RoutePath = '/known-words' | '/vague-words' | '/unknown-words';

function SegmentBar({
  height,
  color,
  count,
  topRadius,
  bottomRadius,
  onPress,
}: {
  height: number;
  color: string;
  count: number;
  topRadius?: boolean;
  bottomRadius?: boolean;
  onPress?: () => void;
}) {
  const showText = height > 16 && count > 0;
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.segment,
        {
          height: Math.max(height, 2),
          backgroundColor: color,
          borderTopLeftRadius: topRadius ? 14 : 0,
          borderTopRightRadius: topRadius ? 14 : 0,
          borderBottomLeftRadius: bottomRadius ? 14 : 0,
          borderBottomRightRadius: bottomRadius ? 14 : 0,
        },
      ]}
    >
      {showText && <Text style={styles.segmentText}>{count}</Text>}
    </TouchableOpacity>
  );
}

export default function CalendarPage() {
  const router = useSafeRouter();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchStats = async () => {
      try {
        const response = await fetchWithRetry(`/api/v1/wordbooks/stats`);
        const data = await response.json();
        if (!cancelled) {
          setStats(data);
        }
      } catch (err) {
        console.error('Error fetching stats:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    fetchStats();
    return () => {
      cancelled = true;
    };
  }, []);

  const getDaySegments = (index: number): DaySegment => {
    if (index === 6 && stats) {
      return {
        ...mockSegments[index],
        known: stats.known || 0,
        vague: stats.vague || 0,
        unknown: stats.unknown || 0,
      };
    }
    return mockSegments[index];
  };

  const getSegmentRenderData = (segment: DaySegment) => {
    const known = segment.known;
    const vague = segment.vague;
    const unknown = segment.unknown;
    const total = known + vague + unknown;
    if (total === 0) {
      return {
        total: 0,
        knownHeight: 0,
        vagueHeight: 0,
        unknownHeight: 0,
      };
    }

    const totalHeight = Math.min((total / MAX_VALUE) * 180, 180);
    return {
      total,
      knownHeight: (known / total) * totalHeight,
      vagueHeight: (vague / total) * totalHeight,
      unknownHeight: (unknown / total) * totalHeight,
    };
  };

  const handleSegmentPress = (route: RoutePath) => {
    router.push(route);
  };

  return (
    <Screen>
      <ScrollView className="flex-1 bg-white" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* 标题区域 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <FontAwesome6 name="arrow-left" size={20} color="#3E2723" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>我的足迹</Text>
          
        </View>

        {/* 柱状图区域 */}
        <View style={styles.chartContainer}>
          {loading && (
            <ActivityIndicator size="small" color="#5D4037" style={{ marginBottom: 12 }} />
          )}

          <View style={styles.chartInner}>
            {mockSegments.map((_, index) => {
              const segment = getDaySegments(index);
              const renderData = getSegmentRenderData(segment);
              const hasData = renderData.total > 0;

              return (
                <View key={index} style={styles.barColumn}>
                  <Text style={styles.barLabel}>
                    {hasData ? `${renderData.total}` : ''}
                  </Text>
                  <View style={styles.barWrapper}>
                    {hasData ? (
                      <>
                        <SegmentBar
                          height={renderData.unknownHeight}
                          color="#E53935"
                          count={segment.unknown}
                          topRadius
                          onPress={() => handleSegmentPress('/unknown-words')}
                        />
                        <SegmentBar
                          height={renderData.vagueHeight}
                          color="#FB8C00"
                          count={segment.vague}
                          onPress={() => handleSegmentPress('/vague-words')}
                        />
                        <SegmentBar
                          height={renderData.knownHeight}
                          color="#43A047"
                          count={segment.known}
                          bottomRadius
                          onPress={() => handleSegmentPress('/known-words')}
                        />
                      </>
                    ) : (
                      <View style={[styles.bar, { height: 4 }]} />
                    )}
                  </View>
                  <Text style={styles.barDay}>{segment.day}</Text>
                </View>
              );
            })}
          </View>

          {/* 图例 */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#43A047' }]} />
              <Text style={styles.legendText}>已会</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FB8C00' }]} />
              <Text style={styles.legendText}>模糊</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#E53935' }]} />
              <Text style={styles.legendText}>不会</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backButton: {
    marginBottom: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#3E2723',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#8D6E63',
  },
  chartContainer: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#F5F0EB',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  chartInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 220,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
  },
  barLabel: {
    fontSize: 11,
    color: '#5D4037',
    fontWeight: '600',
    marginBottom: 6,
    height: 14,
  },
  barWrapper: {
    width: 18,
    height: 180,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
    borderRadius: 14,
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    backgroundColor: '#5D4037',
    borderRadius: 14,
  },
  segment: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  barDay: {
    fontSize: 12,
    color: '#8D6E63',
    marginTop: 8,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 4,
  },
  legendText: {
    fontSize: 11,
    color: '#5D4037',
  },
});
