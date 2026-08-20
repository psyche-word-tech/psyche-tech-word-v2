import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { FontAwesome6 } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { getApiBaseUrl } from '@/utils/apiConfig';
import { useAuth } from '@/contexts/AuthContext';

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

interface IrisAnalysisData {
  avgFocusScore: number;
  dominantEmotion: string;
  gazeDistribution: { up: number; down: number; left: number; right: number; center: number };
  dataPoints: number;
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
  const { user } = useAuth();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [irisModalVisible, setIrisModalVisible] = useState(false);
  const [irisLoading, setIrisLoading] = useState(false);
  const [irisData, setIrisData] = useState<IrisAnalysisData | null>(null);

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

  const loadIrisAnalysis = async () => {
    setIrisModalVisible(true);
    setIrisLoading(true);
    try {
      const response = await fetchWithRetry('/api/v1/iris/analysis');
      const data = await response.json();
      if (data.success && data.data) {
        setIrisData(data.data);
      } else {
        setIrisData(null);
      }
    } catch (error) {
      console.error('加载虹膜分析失败:', error);
      setIrisData(null);
    } finally {
      setIrisLoading(false);
    }
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
          <TouchableOpacity onPress={loadIrisAnalysis} style={styles.irisButton}>
            <FontAwesome6 name="eye" size={18} color="#5D4037" />
          </TouchableOpacity>
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

      {/* 虹膜分析弹窗 */}
      <Modal
        visible={irisModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIrisModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>学习状态分析</Text>
              <TouchableOpacity onPress={() => setIrisModalVisible(false)}>
                <FontAwesome6 name="xmark" size={20} color="#8D6E63" />
              </TouchableOpacity>
            </View>

            {irisLoading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color="#5D4037" />
                <Text style={styles.modalLoadingText}>正在分析...</Text>
              </View>
            ) : irisData ? (
              <View style={styles.modalBody}>
                <View style={styles.statRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>平均专注度</Text>
                    <Text style={styles.statValue}>{Math.round(irisData.averageFocus)}%</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>主要情绪</Text>
                    <Text style={styles.statValue}>{irisData.dominantEmotion}</Text>
                  </View>
                </View>

                <View style={styles.gazeSection}>
                  <Text style={styles.gazeTitle}>视线分布</Text>
                  {Object.entries(irisData.gazeDistribution).map(([direction, value]) => (
                    <View key={direction} style={styles.gazeRow}>
                      <Text style={styles.gazeLabel}>{direction}</Text>
                      <View style={styles.gazeBarBg}>
                        <View style={[styles.gazeBarFill, { width: `${value}%` }]} />
                      </View>
                      <Text style={styles.gazeValue}>{Math.round(value)}%</Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.modalFooter}>
                  共 {irisData.dataPoints} 个数据点
                </Text>
              </View>
            ) : (
              <View style={styles.modalEmpty}>
                <FontAwesome6 name="eye-slash" size={40} color="#BDBDBD" />
                <Text style={styles.modalEmptyText}>暂无虹膜分析数据</Text>
                <Text style={styles.modalEmptyHint}>请先在设置中开启虹膜识别</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
  irisBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  irisBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#FFF8F0',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#5D4037',
    marginBottom: 16,
  },
  irisStat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E6D3',
  },
  irisStatLabel: {
    fontSize: 14,
    color: '#8D6E63',
  },
  irisStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5D4037',
  },
  irisEmpty: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  irisEmptyText: {
    fontSize: 14,
    color: '#8D6E63',
  },
  modalCloseBtn: {
    marginTop: 16,
    backgroundColor: '#5D4037',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
