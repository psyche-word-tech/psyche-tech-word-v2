import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useState, useEffect } from 'react';
import { getApiBaseUrl } from '@/utils/apiConfig';

interface Submission {
  id: string;
  student_id: string;
  image_url: string;
  status: 'pending' | 'graded';
  grade?: string;
  feedback?: string;
  created_at: string;
}

export default function TeacherReviewScreen() {
  const router = useSafeRouter();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSubmissions = async () => {
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/submissions?role=teacher`);
      const data = await res.json();
      if (data.success) {
        setSubmissions(data.data || []);
      }
    } catch (error) {
      console.error('获取提交列表失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSubmissions();
  };

  const renderItem = ({ item }: { item: Submission }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => router.push(`/review-detail?id=${item.id}`)}
      activeOpacity={0.7}
    >
      <Image source={{ uri: item.image_url }} style={styles.thumbnail} />
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle}>
          {item.status === 'pending' ? '待批改' : '已批改'}
        </Text>
        <Text style={styles.itemDate}>
          {new Date(item.created_at).toLocaleString('zh-CN')}
        </Text>
        {item.status === 'graded' && item.grade && (
          <Text style={styles.gradeText}>分数：{item.grade}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );

  return (
    <Screen>
      <View style={styles.container}>
        {/* 顶部导航栏 */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>批改作业</Text>
          <View style={styles.placeholder} />
        </View>

        {/* 统计信息 */}
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

        {/* 列表 */}
        <FlatList
          data={submissions}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyText}>暂无作业提交</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  stats: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#F9FAFB',
    margin: 16,
    borderRadius: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
  },
  listContent: {
    padding: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  itemContent: {
    flex: 1,
    marginLeft: 12,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  itemDate: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
  },
  gradeText: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '600',
    marginTop: 4,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 16,
  },
});
