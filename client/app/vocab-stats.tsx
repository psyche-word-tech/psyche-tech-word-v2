import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useCallback } from 'react';
import { getApiBaseUrl } from '@/utils/apiConfig';

interface UserStat {
  user_id: number;
  name: string;
  base: number;
  required: number;
  elective: number;
  total: number;
}

interface Summary {
  users: number;
  base: number;
  required: number;
  elective: number;
  total: number;
}

export default function VocabStatsScreen() {
  const router = useSafeRouter();
  const { user } = useAuth();
  const [list, setList] = useState<UserStat[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchStats = useCallback(async () => {
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/v1/gk-vocab/stats/users`, {
        headers: { 'Authorization': `Bearer ${user?.token}` },
      });
      if (res.status === 403) {
        Alert.alert('无权限', '只有老师可以查看词汇统计');
        return;
      }
      const data = await res.json();
      if (data.list) {
        setList(data.list);
        setSummary(data.summary || null);
        setErrorMessage('');
      } else {
        setErrorMessage(data.error || '加载失败');
      }
    } catch (error) {
      setErrorMessage('网络异常，请重试');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.token]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStats();
  }, [fetchStats]);

  return (
    <Screen>
      {/* 顶部导航栏 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>词汇量统计</Text>
        <View style={styles.placeholder} />
      </View>

      {/* 概要卡片 */}
      {summary && !loading && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>已测试用户 {summary.users} 人</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryValue}>{summary.base}</Text>
              <Text style={styles.summaryLabel}>基础词</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryValue}>{summary.required}</Text>
              <Text style={styles.summaryLabel}>必修词</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryValue}>{summary.elective}</Text>
              <Text style={styles.summaryLabel}>选修词</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={[styles.summaryValue, styles.summaryValueTotal]}>{summary.total}</Text>
              <Text style={styles.summaryLabel}>总词汇量</Text>
            </View>
          </View>
        </View>
      )}

      {/* 错误提示 */}
      {errorMessage !== '' && !loading && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#6D28D9" /></View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* 表头 */}
          {list.length > 0 && (
            <View style={[styles.row, styles.headRow]}>
              <Text style={[styles.cell, styles.cellName, styles.headText]}>用户</Text>
              <Text style={[styles.cell, styles.headText]}>基础词</Text>
              <Text style={[styles.cell, styles.headText]}>必修词</Text>
              <Text style={[styles.cell, styles.headText]}>选修词</Text>
              <Text style={[styles.cell, styles.cellTotal, styles.headText]}>总词汇量</Text>
            </View>
          )}

          {list.length === 0 && !loading ? (
            <View style={styles.emptyBox}><Text style={styles.emptyText}>暂无做过词汇量测试的用户</Text></View>
          ) : (
            list.map((item, i) => (
              <View key={item.user_id} style={[styles.row, i % 2 === 1 && styles.rowAlt]}>
                <Text style={[styles.cell, styles.cellName]} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.cell}>{item.base}</Text>
                <Text style={styles.cell}>{item.required}</Text>
                <Text style={styles.cell}>{item.elective}</Text>
                <Text style={[styles.cell, styles.cellTotal]}>{item.total}</Text>
              </View>
            ))
          )}

          {/* 汇总行 */}
          {list.length > 0 && summary && (
            <View style={[styles.row, styles.totalRow]}>
              <Text style={[styles.cell, styles.cellName, styles.totalText]}>合计</Text>
              <Text style={[styles.cell, styles.totalText]}>{summary.base}</Text>
              <Text style={[styles.cell, styles.totalText]}>{summary.required}</Text>
              <Text style={[styles.cell, styles.totalText]}>{summary.elective}</Text>
              <Text style={[styles.cell, styles.cellTotal, styles.totalText]}>{summary.total}</Text>
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  summaryCard: {
    margin: 16,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
  },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  summaryValueTotal: {
    color: '#6D28D9',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  errorBox: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 6,
  },
  rowAlt: {
    backgroundColor: '#FAFAFA',
  },
  headRow: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  cell: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    textAlign: 'center',
  },
  cellName: {
    flex: 1.4,
    textAlign: 'left',
    fontWeight: '600',
    color: '#111827',
  },
  cellTotal: {
    fontWeight: '700',
    color: '#6D28D9',
  },
  headText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  totalRow: {
    backgroundColor: '#EDE9FE',
    marginTop: 4,
  },
  totalText: {
    fontWeight: '800',
    color: '#5B21B6',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
});