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
  incomplete?: boolean;
}

export default function VocabStatsScreen() {
  const router = useSafeRouter();
  const { user } = useAuth();
  const [list, setList] = useState<UserStat[]>([]);
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
          {list.some((it) => it.incomplete) && (
            <Text style={styles.legendNote}>注：带「—」的用户为旧版单次测试记录，仅保留总量，请让其重新测试以获取基础/必修/选修分项。</Text>
          )}

          {list.length === 0 && !loading ? (
            <View style={styles.emptyBox}><Text style={styles.emptyText}>暂无做过词汇量测试的用户</Text></View>
          ) : (
            list.map((item, i) => (
              <View key={item.user_id} style={[styles.row, i % 2 === 1 && styles.rowAlt]}>
                <Text style={[styles.cell, styles.cellName]} numberOfLines={1}>{item.name}</Text>
                {item.incomplete ? (
                  <>
                    <Text style={[styles.cell, styles.cellDash]}>—</Text>
                    <Text style={[styles.cell, styles.cellDash]}>—</Text>
                    <Text style={[styles.cell, styles.cellDash]}>—</Text>
                    <Text style={[styles.cell, styles.cellHint]}>{item.total}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.cell}>{item.base}</Text>
                    <Text style={styles.cell}>{item.required}</Text>
                    <Text style={styles.cell}>{item.elective}</Text>
                    <Text style={[styles.cell, styles.cellTotal]}>{item.total}</Text>
                  </>
                )}
              </View>
            ))
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
  cellDash: {
    color: '#D1D5DB',
  },
  cellHint: {
    fontWeight: '700',
    color: '#B45309',
  },
  legendNote: {
    marginHorizontal: 16,
    marginTop: 4,
    fontSize: 12,
    color: '#B45309',
  },
  headText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
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