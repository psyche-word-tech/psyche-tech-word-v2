import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, RefreshControl, ActivityIndicator, ScrollView } from 'react-native';
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
  annotations?: { className?: string; studentName?: string; grading?: GradingData };
  created_at: string;
}

interface GradingData {
  total_score?: number;
  max_score?: number;
  comments?: string;
  strengths?: string[];
  improvements?: string[];
  errors?: Array<{ original?: string; correction?: string; explanation?: string }>;
  marked_images?: string[];
  graded_at?: string;
}

interface GradedModal {
  visible: boolean;
  submission: Submission | null;
}

export default function MySubmissionsScreen() {
  const router = useSafeRouter();
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gradedModal, setGradedModal] = useState<GradedModal>({ visible: false, submission: null });

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
    const grading = item.annotations?.grading;
    const isGraded = item.status === 'graded';
    const score = grading?.total_score != null ? grading.total_score : item.grade;
    const maxScore = grading?.max_score;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        disabled={!isGraded}
        onPress={() => isGraded && setGradedModal({ visible: true, submission: item })}
        style={styles.item}
      >
        <Image source={{ uri: item.image_url }} style={styles.image} resizeMode="cover" />
        <View style={styles.itemContent}>
          <View style={styles.itemTop}>
            <Text style={styles.itemClass}>{meta.className}</Text>
            <View style={[styles.statusBadge, isGraded ? styles.statusGraded : styles.statusPending]}>
              <Text style={[styles.statusText, isGraded ? styles.statusTextGraded : styles.statusTextPending]}>
                {isGraded ? '已批改' : '待批改'}
              </Text>
            </View>
          </View>
          {isGraded && (
            <>
              {score != null && (
                <View style={styles.gradeRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={styles.gradeText}>
                    得分：{score}{maxScore != null ? ` / ${maxScore}` : ''}
                  </Text>
                </View>
              )}
              {grading?.comments ? <Text style={styles.feedbackText} numberOfLines={2}>{grading.comments}</Text>
                : item.feedback ? <Text style={styles.feedbackText} numberOfLines={2}>{item.feedback}</Text> : null}
              <Text style={styles.viewDetail}>点击查看批改详情 ›</Text>
            </>
          )}
          <Text style={styles.itemDate}>{new Date(item.created_at).toLocaleString('zh-CN')}</Text>
        </View>
      </TouchableOpacity>
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

      {gradedModal.visible && gradedModal.submission && (() => {
        const s = gradedModal.submission;
        const g = s.annotations?.grading;
        const maxScore = g?.max_score;
        const score = g?.total_score != null ? g.total_score : s.grade;
        return (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>批改详情</Text>
                <TouchableOpacity onPress={() => setGradedModal({ visible: false, submission: null })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={22} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalBody}>
                {score != null && (
                  <View style={styles.detailScoreRow}>
                    <Text style={styles.detailScoreLabel}>得分</Text>
                    <Text style={styles.detailScoreValue}>
                      {score}{maxScore != null ? ` / ${maxScore}` : ''}
                    </Text>
                  </View>
                )}
                {g?.comments ? (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>总评</Text>
                    <Text style={styles.detailSectionText}>{g.comments}</Text>
                  </View>
                ) : null}
                {!!g?.strengths?.length && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>优点</Text>
                    {g.strengths.map((t, i) => (
                      <View key={i} style={styles.detailBulletRow}>
                        <Text style={styles.detailBullet}>•</Text>
                        <Text style={styles.detailSectionText}>{t}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {!!g?.improvements?.length && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>改进建议</Text>
                    {g.improvements.map((t, i) => (
                      <View key={i} style={styles.detailBulletRow}>
                        <Text style={styles.detailBullet}>•</Text>
                        <Text style={styles.detailSectionText}>{t}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {!!g?.errors?.length && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>错误订正</Text>
                    {g.errors.map((e, i) => (
                      <View key={i} style={styles.errorRow}>
                        <Text style={styles.errorOriginal}>{e.original || ''}</Text>
                        <Text style={styles.errorArrow}>→</Text>
                        <Text style={styles.errorCorrection}>{e.correction || ''}</Text>
                        {!!e.explanation && <Text style={styles.errorExplanation}>{e.explanation}</Text>}
                      </View>
                    ))}
                  </View>
                )}
                {!!g?.marked_images?.length && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>批改标注图</Text>
                    {g.marked_images.map((uri, i) => (
                      <Image key={i} source={{ uri }} style={styles.markedImage} resizeMode="contain" />
                    ))}
                  </View>
                )}
                {g?.graded_at && (
                  <Text style={styles.gradedAt}>批改时间：{new Date(g.graded_at).toLocaleString('zh-CN')}</Text>
                )}
              </ScrollView>
            </View>
          </View>
        );
      })()}
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
  gradeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  gradeText: { fontSize: 14, color: '#10B981', fontWeight: '700', marginLeft: 4 },
  feedbackText: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  itemDate: { fontSize: 12, color: '#9CA3AF', marginTop: 6 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { fontSize: 16, color: '#9CA3AF', marginTop: 16 },

  viewDetail: { fontSize: 12, color: '#3B82F6', marginTop: 6, fontWeight: '500' },

  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 100,
  },
  modalContainer: {
    position: 'absolute', left: 16, right: 16, top: 60, bottom: 40,
    backgroundColor: '#FFFFFF', borderRadius: 16, zIndex: 101, overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937' },
  modalBody: { flex: 1, padding: 16 },
  detailScoreRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', borderRadius: 12,
    padding: 14, marginBottom: 12,
  },
  detailScoreLabel: { fontSize: 15, color: '#047857', fontWeight: '600', marginRight: 8 },
  detailScoreValue: { fontSize: 22, fontWeight: '800', color: '#047857' },
  detailSection: { marginBottom: 16 },
  detailSectionTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  detailSectionText: { fontSize: 14, color: '#4B5563', lineHeight: 21, flex: 1 },
  detailBulletRow: { flexDirection: 'row', marginBottom: 4 },
  detailBullet: { fontSize: 14, color: '#9CA3AF', marginRight: 6 },
  errorRow: { marginBottom: 8, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10 },
  errorOriginal: { fontSize: 13, color: '#B45309', textDecorationLine: 'line-through' },
  errorArrow: { fontSize: 13, color: '#9CA3AF', marginVertical: 2 },
  errorCorrection: { fontSize: 13, color: '#047857', fontWeight: '600' },
  errorExplanation: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  markedImage: { width: '100%', height: 260, backgroundColor: '#F9FAFB', borderRadius: 8, marginBottom: 10 },
  gradedAt: { fontSize: 12, color: '#9CA3AF', marginTop: 4, textAlign: 'right' },
});