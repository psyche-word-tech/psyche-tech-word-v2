import { Modal, View, Text, StyleSheet, TouchableOpacity, FlatList, ScrollView, RefreshControl, ActivityIndicator, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useCallback, useEffect } from 'react';
import { getApiBaseUrl } from '@/utils/apiConfig';

interface Favorite {
  id: string;
  question_text: string;
  subject?: string | null;
  answer?: string | null;
  analysis?: string | null;
  solution?: string | null;
  tips?: string | null;
  image_url?: string | null;
  created_at: string;
}

type QStatus = 'wrong' | 'attention' | 'correct' | 'blank';

function parseTips(tips?: string | null): { status?: QStatus; user_answer?: string; knowledge_point?: string; core_competency?: string; difficulty?: string } {
  try {
    return JSON.parse(tips || '{}') || {};
  } catch {
    return {};
  }
}

const STATUS_META: Record<QStatus, { label: string; bg: string; fg: string }> = {
  wrong: { label: '错', bg: '#FEE2E2', fg: '#B91C1C' },
  attention: { label: '重点', bg: '#FEF3C7', fg: '#B45309' },
  correct: { label: '对', bg: '#DCFCE7', fg: '#15803D' },
  blank: { label: '未答', bg: '#F3F4F6', fg: '#6B7280' },
};

export default function MyFavoritesScreen() {
  const router = useSafeRouter();
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Favorite | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const fetchFavorites = useCallback(async () => {
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/v1/favorites`, {
        headers: { 'Authorization': `Bearer ${user?.token}` },
      });
      const data = await res.json();
      if (data.success) {
        setFavorites(data.data || []);
        setFailed(false);
      } else {
        setFailed(true);
      }
    } catch (error) {
      console.error('获取收藏失败:', error);
      setFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.token]);

  useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const handleDelete = async (item: Favorite) => {
    if (confirmId !== item.id) {
      setConfirmId(item.id);
      return;
    }
    setConfirmId(null);
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/v1/favorites/${item.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${user?.token}` },
      });
      const data = await res.json();
      if (data.success) {
        setFavorites((prev) => prev.filter((f) => f.id !== item.id));
        setToast(null);
      } else {
        setToast(data.message || '删除失败，请重试');
      }
    } catch {
      setToast('网络错误，删除失败');
    }
  };

  const handleDownload = async () => {
    if (Platform.OS !== 'web') {
      setToast('请使用网页端下载');
      return;
    }
    try {
      setDownloading(true);
      setToast(null);
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/v1/favorites/export`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user?.token}` },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setToast(j.message || '导出失败');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '错题训练.docx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setToast('已生成错题训练文档，并开始下载');
    } catch {
      setToast('网络错误，导出失败');
    } finally {
      setDownloading(false);
    }
  };

  // 按学科分组
  const grouped = favorites.reduce<Record<string, Favorite[]>>((acc, f) => {
    const s = f.subject || '其他';
    (acc[s] = acc[s] || []).push(f);
    return acc;
  }, {});
  const subjects = Object.keys(grouped);
  const shownSubjects = activeSubject ? [activeSubject] : subjects;
  const listData = shownSubjects.map((s) => ({ subject: s, items: grouped[s] }));

  const stripHtml = (text: string, full = false) =>
    text.replace(/<[^>]*>/g, '').replace(/\\\(|\\\[|\\\)|\\\]/g, '').slice(0, full ? undefined : 60);

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>我的收藏</Text>
          <View style={styles.placeholder} />
        </View>

        {/* 工具行：学科过滤 + 导出错题 */}
        <View style={styles.toolbar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subjectBar} contentContainerStyle={styles.subjectBarContent}>
            <TouchableOpacity
              style={[styles.subjectChip, activeSubject === null && styles.subjectChipActive]}
              onPress={() => setActiveSubject(null)}
              activeOpacity={0.7}
            >
              <Text style={[styles.subjectChipText, activeSubject === null && styles.subjectChipTextActive]}>全部</Text>
            </TouchableOpacity>
            {subjects.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.subjectChip, activeSubject === s && styles.subjectChipActive]}
                onPress={() => setActiveSubject(s)}
                activeOpacity={0.7}
              >
                <Text style={[styles.subjectChipText, activeSubject === s && styles.subjectChipTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={[styles.exportBtn, downloading && styles.exportBtnDisabled]}
            onPress={handleDownload}
            disabled={downloading}
            activeOpacity={0.7}
          >
            <Ionicons name="download-outline" size={16} color="#3B82F6" />
            <Text style={styles.exportBtnText}>{downloading ? '生成中' : '导出错题'}</Text>
          </TouchableOpacity>
        </View>
        {toast ? (
          <View style={styles.toast} pointerEvents="none">
            <Ionicons name="checkmark-circle" size={16} color="#34D399" />
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}

        <FlatList
          data={listData}
          keyExtractor={(item) => item.subject}
          renderItem={({ item }) => (
            <View style={styles.group}>
              <Text style={styles.groupTitle}>{item.subject}（{item.items.length}）</Text>
              {item.items.map((f) => {
                const tips = parseTips(f.tips);
                const meta = tips.status ? STATUS_META[tips.status] : null;
                return (
                <View key={f.id} style={styles.favRow}>
                <TouchableOpacity style={styles.favItem} activeOpacity={0.7} onPress={() => {
                  setConfirmId(null);
                  setDetail(f);
                }}>
                  {f.image_url ? (
                    <Image source={{ uri: f.image_url }} style={styles.favThumb} resizeMode="cover" />
                  ) : (
                    <View style={[styles.favThumb, styles.favThumbPlaceholder]}>
                      <Ionicons name="document-text-outline" size={28} color="#D1D5DB" />
                    </View>
                  )}
                  <View style={styles.favContent}>
                    <View style={styles.favTitleRow}>
                      {meta && (
                        <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                          <Text style={[styles.statusBadgeText, { color: meta.fg }]}>{meta.label}</Text>
                        </View>
                      )}
                      <Text style={styles.favTitle} numberOfLines={2}>
                        {f.question_text ? stripHtml(f.question_text) : '（图片题目）'}
                      </Text>
                    </View>
                    {(tips.core_competency || tips.difficulty) && (
                      <View style={styles.tagRow}>
                        {tips.core_competency ? (
                          <View style={[styles.tag, { backgroundColor: '#F5F3FF' }]}>
                            <Text style={[styles.tagText, { color: '#7C3AED' }]}>{tips.core_competency}</Text>
                          </View>
                        ) : null}
                        {tips.difficulty ? (
                          <View style={[styles.tag, { backgroundColor: '#FFF7ED' }]}>
                            <Text style={[styles.tagText, { color: '#EA580C' }]}>{tips.difficulty}</Text>
                          </View>
                        ) : null}
                      </View>
                    )}
                    <Text style={styles.favDate} numberOfLines={1}>
                      {tips.knowledge_point ? `${tips.knowledge_point} · ` : ''}{new Date(f.created_at).toLocaleDateString('zh-CN')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#CCC" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.delBtn, confirmId === f.id && styles.delBtnActive]}
                  activeOpacity={0.7}
                  onPress={() => handleDelete(f)}
                >
                  <Ionicons name="trash-outline" size={17} color={confirmId === f.id ? '#B91C1C' : '#9CA3AF'} />
                  <Text style={[styles.delText, confirmId === f.id && styles.delTextActive]}>
                    {confirmId === f.id ? '确认?' : '删除'}
                  </Text>
                </TouchableOpacity>
                </View>
                );
              })}
            </View>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchFavorites(); }} />}
          ListEmptyComponent={
            loading ? (
              <View style={styles.empty}><ActivityIndicator color="#3B82F6" /></View>
            ) : failed ? (
              <View style={styles.empty}>
                <Ionicons name="cloud-offline-outline" size={64} color="#FCA5A5" />
                <Text style={styles.emptyText}>加载失败，服务暂时不可用</Text>
                <Text style={styles.emptySubText}>请稍后下拉刷新重试</Text>
              </View>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="star-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyText}>还没有收藏题目</Text>
              </View>
            )
          }
          contentContainerStyle={styles.listContent}
        />
      </View>

      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>题目详情</Text>
              <TouchableOpacity onPress={() => setDetail(null)} style={styles.modalClose}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
              {detail && (() => {
                const t = parseTips(detail.tips);
                const meta = t.status ? STATUS_META[t.status] : null;
                return (
                  <>
                    <View style={styles.modalContextWrap}>
                      <Text style={styles.modalLabel}>原文语境 · 上句 / 本句 / 下句</Text>
                      {meta && (
                        <View style={[styles.modalBadge, { backgroundColor: meta.bg }]}>
                          <Text style={[styles.modalBadgeText, { color: meta.fg }]}>{meta.label}</Text>
                        </View>
                      )}
                      <Text style={styles.modalContext}>
                        {detail.question_text ? stripHtml(detail.question_text, true) : '（图片题目）'}
                      </Text>
                    </View>
                    {t.user_answer ? <Field label="我的答案" value={t.user_answer} /> : null}
                    {detail.answer ? <Field label="正确答案" value={stripHtml(String(detail.answer), true)} /> : null}
                    {detail.analysis ? <Field label="错因 / 要点" value={stripHtml(String(detail.analysis), true)} /> : null}
                    {detail.solution ? <Field label="详细解析" value={stripHtml(String(detail.solution), true)} /> : null}
                    {t.knowledge_point ? <Field label="知识点" value={t.knowledge_point} /> : null}
                    {t.core_competency ? <Field label="核心素养" value={t.core_competency} /> : null}
                    {t.difficulty ? <Field label="难度" value={t.difficulty} /> : null}
                  </>
                );
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
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
  subjectChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  subjectChipActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  subjectChipText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  subjectChipTextActive: { color: '#FFFFFF' },
  listContent: { padding: 16 },
  group: { marginBottom: 20 },
  groupTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 10 },
  favRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  favItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: '#F3F4F6',
  },
  delBtn: {
    width: 52, alignItems: 'center', justifyContent: 'center', paddingVertical: 8,
    marginLeft: 8, borderRadius: 10, backgroundColor: '#F5F6F8',
  },
  delBtnActive: { backgroundColor: '#FEE2E2' },
  delText: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  delTextActive: { color: '#B91C1C', fontWeight: '700' },
  favThumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#F3F4F6' },
  favThumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  favContent: { flex: 1, marginLeft: 12 },
  favTitleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  statusBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginRight: 6, marginTop: 1 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  tag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginRight: 6 },
  tagText: { fontSize: 11, fontWeight: '600' },
  favTitle: { fontSize: 14, fontWeight: '600', color: '#1F2937', lineHeight: 20 },
  favDate: { fontSize: 12, color: '#9CA3AF', marginTop: 6 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { fontSize: 16, color: '#9CA3AF', marginTop: 16 },
  emptySubText: { fontSize: 13, color: '#C4C7CC', marginTop: 6 },
  placeholder: { width: 40 },
  toolbar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, marginTop: 10, marginBottom: 6,
  },
  subjectBar: { flex: 1 },
  subjectBarContent: { paddingRight: 4, gap: 8, alignItems: 'center' },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EFF6FF', borderRadius: 16,
    paddingHorizontal: 12, height: 32, marginLeft: 12,
  },
  exportBtnDisabled: { opacity: 0.55 },
  exportBtnText: { color: '#3B82F6', fontSize: 13, fontWeight: '600', marginLeft: 5 },
  toast: {
    position: 'absolute', top: 64, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(17,24,39,0.9)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9, maxWidth: '86%', zIndex: 20,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  toastText: { color: '#FFFFFF', fontSize: 13, marginLeft: 6 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16,
    height: '86%', overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  modalClose: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  modalBody: { flex: 1, paddingHorizontal: 16, paddingVertical: 14 },
  modalBodyContent: { paddingBottom: 24, flexGrow: 1 },
  modalContextWrap: {
    backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, marginBottom: 14,
    borderWidth: 1, borderColor: '#EEF2F7',
  },
  modalLabel: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  modalContext: { fontSize: 15, lineHeight: 23, color: '#1F2937' },
  modalBadge: {
    alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 8,
  },
  modalBadgeText: { fontSize: 12, fontWeight: '700' },
  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  fieldLabel: { width: 84, fontSize: 14, color: '#6B7280', fontWeight: '600', paddingTop: 1 },
  fieldValue: { flex: 1, fontSize: 14, lineHeight: 21, color: '#1F2937' },
});