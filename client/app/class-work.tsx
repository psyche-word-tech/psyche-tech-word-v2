import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useCallback } from 'react';
import { getApiBaseUrl } from '@/utils/apiConfig';

const CLASSES = ['308班', '201班'];

interface Submission {
  id: string;
  image_url: string;
  status: 'pending' | 'graded';
  grade?: string;
  annotations?: { studentName?: string; className?: string };
  created_at: string;
}

export default function ClassWorkScreen() {
  const router = useSafeRouter();
  const { user } = useAuth();
  const [activeClass, setActiveClass] = useState(CLASSES[0]);
  const [activeType, setActiveType] = useState('全部');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reporting, setReporting] = useState(false);

  const TYPES = ['全部', '小作文', '读后续写'];

  const getMeta = (s: Submission) => {
    return {
      studentName: s.annotations?.studentName || '未填姓名',
      className: s.annotations?.className || '未知班级',
    };
  };

  const fetchSubmissions = useCallback(async () => {
    try {
      const apiBase = getApiBaseUrl();
      const typeParam = activeType === '全部' ? '' : `&type=${encodeURIComponent(activeType)}`;
      const res = await fetch(`${apiBase}/api/v1/submissions/class/${encodeURIComponent(activeClass)}?${typeParam}`, {
        headers: { 'Authorization': `Bearer ${user?.token}` },
      });
      if (res.status === 403) {
        Alert.alert('无权限', '只有老师可以查看作业');
        return;
      }
      const data = await res.json();
      if (data.success) {
        setSubmissions(data.data || []);
      }
    } catch (error) {
      console.error('获取作业失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeClass, activeType, user?.token]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSubmissions();
  };

  const handleDownloadReport = async () => {
    setReporting(true);
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/v1/submissions/class/${encodeURIComponent(activeClass)}/report`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user?.token}` },
      });
      if (!res.ok) {
        Alert.alert('下载失败', '生成报告失败');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeClass}-学情报告.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下载报告失败:', error);
      Alert.alert('下载失败', '网络异常，请重试');
    } finally {
      setReporting(false);
    }
  };

  const handleDelete = (item: Submission) => {
    const meta = getMeta(item);
    Alert.alert(
      '删除作业',
      `确定删除 ${meta.studentName}（${meta.className}）的这份作业吗？此操作不可恢复。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              const apiBase = getApiBaseUrl();
              const res = await fetch(`${apiBase}/api/v1/submissions/${item.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${user?.token}` },
              });
              const data = await res.json();
              if (data.success) {
                Alert.alert('已删除', '作业已删除', [{ text: '确定' }]);
                fetchSubmissions();
              } else {
                Alert.alert('删除失败', data.message || '请重试');
              }
            } catch (error) {
              console.error('删除作业失败:', error);
              Alert.alert('删除失败', '网络异常，请重试');
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: Submission }) => {
    const meta = getMeta(item);
    return (
      <View style={styles.item}>
        <Image source={{ uri: item.image_url }} style={styles.image} resizeMode="cover" />
        <View style={styles.itemContent}>
          <Text style={styles.itemName}>{meta.studentName}</Text>
          <Text style={styles.itemClass}>{meta.className}</Text>
          <View style={styles.itemMeta}>
            <View style={[styles.statusBadge, item.status === 'graded' ? styles.statusGraded : styles.statusPending]}>
              <Text style={[styles.statusText, item.status === 'graded' ? styles.statusTextGraded : styles.statusTextPending]}>
                {item.status === 'graded' ? '已批改' : '待批改'}
              </Text>
            </View>
            {item.status === 'graded' && item.grade && (
              <Text style={styles.itemGrade}>分数：{item.grade}</Text>
            )}
          </View>
          <Text style={styles.itemDate}>
            {new Date(item.created_at).toLocaleString('zh-CN')}
          </Text>
          <TouchableOpacity
            style={styles.itemDeleteBtn}
            onPress={() => handleDelete(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={14} color="#DC2626" />
            <Text style={styles.itemDeleteText}>删除作业</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Screen>
      <View style={styles.container}>
        {/* 顶部导航栏 */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>作业查看</Text>
          <View style={styles.placeholder} />
        </View>

        {/* 班级选择 */}
        <View style={styles.classRow}>
          {CLASSES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.classChip, activeClass === c && styles.classChipActive]}
              onPress={() => setActiveClass(c)}
              activeOpacity={0.7}
            >
              <Text style={[styles.classChipText, activeClass === c && styles.classChipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 作业类型筛选 */}
        <View style={styles.classRow}>
          {TYPES.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.classChip, activeType === t && styles.classChipActive]}
              onPress={() => setActiveType(t)}
              activeOpacity={0.7}
            >
              <Text style={[styles.classChipText, activeType === t && styles.classChipTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 操作按钮：批改 + 下载报告 */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.gradeBtn]}
            onPress={() =>
              router.push('/essay-grading', {
                cls: activeClass,
                type: activeType,
              })}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>批改</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.reportBtn]}
            onPress={handleDownloadReport}
            disabled={reporting}
            activeOpacity={0.7}
          >
            {reporting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="download" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>下载学情报告</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* 列表 */}
        <FlatList
          data={submissions}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            loading ? (
              <View style={styles.empty}>
                <ActivityIndicator color="#3B82F6" />
              </View>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="document-text-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyText}>该班级暂无作业提交</Text>
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
  classRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  classChip: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  classChipActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  classChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  classChipTextActive: {
    color: '#FFFFFF',
  },
  reportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 12,
  },
  gradeBtn: {
    backgroundColor: '#8B5CF6',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  image: {
    width: 72,
    height: 96,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  itemContent: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  itemClass: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusGraded: {
    backgroundColor: '#D1FAE5',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextPending: {
    color: '#B45309',
  },
  statusTextGraded: {
    color: '#047857',
  },
  itemGrade: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '600',
  },
  itemDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 6,
  },
  itemDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
  },
  itemDeleteText: {
    fontSize: 12,
    color: '#DC2626',
    marginLeft: 4,
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