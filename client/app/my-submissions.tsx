import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, RefreshControl, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useCallback, useEffect } from 'react';
import { getApiBaseUrl } from '@/utils/apiConfig';

interface Submission {
  id: string;
  image_url: string;
  status: 'pending' | 'graded';
  grade?: string;
  feedback?: string;
  annotations?: { className?: string; studentName?: string };
  created_at: string;
}

export default function MySubmissionsScreen() {
  const router = useSafeRouter();
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const getMeta = (s: Submission) => ({
    className: s.annotations?.className || '未知班级',
    studentName: s.annotations?.studentName || '匿名',
  });

  const fetchSubmissions = useCallback(async () => {
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/v1/submissions`, {
        headers: { 'Authorization': `Bearer ${user?.token}` },
      });
      const data = await res.json();
      if (data.success) {
        setSubmissions(data.data || []);
      }
    } catch (error) {
      console.error('获取已提交作业失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.token]);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  const renderItem = ({ item }: { item: Submission }) => {
    const meta = getMeta(item);
    return (
      <View style={styles.item}>
        <Image source={{ uri: item.image_url }} style={styles.image} resizeMode="cover" />
        <View style={styles.itemContent}>
          <View style={styles.itemTop}>
            <Text style={styles.itemClass}>{meta.className}</Text>
            <View style={[styles.statusBadge, item.status === 'graded' ? styles.statusGraded : styles.statusPending]}>
              <Text style={[styles.statusText, item.status === 'graded' ? styles.statusTextGraded : styles.statusTextPending]}>
                {item.status === 'graded' ? '已批改' : '待批改'}
              </Text>
            </View>
          </View>
          {item.status === 'graded' && (
            <>
              {item.grade ? <Text style={styles.gradeText}>分数：{item.grade}</Text> : null}
              {item.feedback ? <Text style={styles.feedbackText} numberOfLines={2}>{item.feedback}</Text> : null}
            </>
          )}
          <Text style={styles.itemDate}>{new Date(item.created_at).toLocaleString('zh-CN')}</Text>
        </View>
      </View>
    );
  };

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>已提交</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{submissions.filter(s => s.status === 'pending').length}</Text>
            <Text style={styles.statLabel}>待批改</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{submissions.filter(s => s.status === 'graded').length}</Text>
            <Text style={styles.statLabel}>已批改</Text>
          </View>
        </View>

        <FlatList
          data={submissions}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSubmissions(); }} />}
          ListEmptyComponent={
            loading ? (
              <View style={styles.empty}><ActivityIndicator color="#3B82F6" /></View>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="document-text-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyText}>还没有提交过作业</Text>
              </View>
            )
          }
          contentContainerStyle={styles.listContent}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937' },
  placeholder: { width: 40 },
  stats: {
    flexDirection: 'row', padding: 16, backgroundColor: '#F9FAFB', margin: 16, borderRadius: 12,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: '700', color: '#1F2937' },
  statLabel: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  statDivider: { width: 1, backgroundColor: '#E5E7EB' },
  listContent: { padding: 16, paddingTop: 0 },
  item: {
    flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  image: { width: 72, height: 96, borderRadius: 8, backgroundColor: '#F3F4F6' },
  itemContent: { flex: 1, marginLeft: 12 },
  itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemClass: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  statusPending: { backgroundColor: '#FEF3C7' },
  statusGraded: { backgroundColor: '#D1FAE5' },
  statusText: { fontSize: 12, fontWeight: '600' },
  statusTextPending: { color: '#B45309' },
  statusTextGraded: { color: '#047857' },
  gradeText: { fontSize: 13, color: '#10B981', fontWeight: '600', marginTop: 6 },
  feedbackText: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  itemDate: { fontSize: 12, color: '#9CA3AF', marginTop: 6 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { fontSize: 16, color: '#9CA3AF', marginTop: 16 },
});