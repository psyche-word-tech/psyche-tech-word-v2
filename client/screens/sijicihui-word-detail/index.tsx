import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, Alert } from 'react-native';
import Slider from '@react-native-community/slider';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { fetchWithRetry } from '@/utils/apiClient';

interface Word {
  id: number;
  word: string;
  meaning: string;
  phonetic?: string;
  status?: string;
}

const CATEGORIES = [
  { status: 'known', label: '已会', color: '#66BB6A' },
  { status: 'vague', label: '模糊', color: '#FFA726' },
  { status: 'unknown', label: '不会', color: '#EF5350' },
];

// 当前词记忆状态 → 熟悉度初始映射
const FAMILIARITY_MAP: Record<string, number> = { known: 80, vague: 50, unknown: 25 };

export default function SijicihuiWordDetail() {
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ word: string; status?: string }>();
  const initialWord: Word = (() => {
    if (params.word) {
      try { return JSON.parse(params.word); } catch { /* ignore */ }
    }
    return { id: 0, word: '', meaning: '', phonetic: '' };
  })();

  const [queue, setQueue] = useState<Word[]>([]);
  const [cursor, setCursor] = useState(-1);
  const [currentStatus, setCurrentStatus] = useState<string>(params.status || '');
  const [categoryCounts, setCategoryCounts] = useState({ known: 0, vague: 0, unknown: 0 });
  const [familiarity, setFamiliarity] = useState(FAMILIARITY_MAP[params.status || ''] ?? 50);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [commentText, setCommentText] = useState('');

  const currentWord: Word = cursor >= 0 && queue[cursor] ? queue[cursor] : initialWord;

  const loadCounts = useCallback(async () => {
    try {
      const res = await fetchWithRetry('/api/v1/sijicihui-study/progress');
      const json = await res.json();
      if (json?.success && json.data) {
        setCategoryCounts({
          known: json.data.known ?? 0,
          vague: json.data.vague ?? 0,
          unknown: json.data.unknown ?? 0,
        });
      }
    } catch (e) {
      console.error('load counts failed:', e);
    }
  }, []);

  const loadQueue = useCallback(async () => {
    try {
      const [queueRes, countRes] = await Promise.all([
        fetchWithRetry('/api/v1/sijicihui-study/words?status=&page=1&limit=200'),
        fetchWithRetry('/api/v1/sijicihui-study/progress'),
      ]);
      const queueJson = await queueRes.json();
      if (queueJson?.success && Array.isArray(queueJson.data)) {
        setQueue(queueJson.data as Word[]);
        const idx = queueJson.data.findIndex((w: any) => w.id === initialWord.id);
        setCursor(idx);
        if (idx >= 0 && queueJson.data[idx].status) {
          setCurrentStatus(queueJson.data[idx].status);
          setFamiliarity(FAMILIARITY_MAP[queueJson.data[idx].status] ?? 50);
        }
      }
      const countJson = await countRes.json();
      if (countJson?.success && countJson.data) {
        setCategoryCounts({
          known: countJson.data.known ?? 0,
          vague: countJson.data.vague ?? 0,
          unknown: countJson.data.unknown ?? 0,
        });
      }
    } catch (e) {
      console.error('load queue failed:', e);
    } finally {
      setLoading(false);
    }
  }, [initialWord.id]);

  useEffect(() => {
    const timer = setTimeout(() => loadQueue(), 0);
    return () => clearTimeout(timer);
  }, [loadQueue]);

  const classify = async (status: string) => {
    try {
      const response = await fetchWithRetry(`/api/v1/sijicihui-study/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordId: currentWord.id, status }),
      });
      if (!response.ok) return;
    } catch (e) {
      console.error('classify failed:', e);
      return;
    }

    const next = cursor + 1;
    if (cursor === -1 || next < queue.length) {
      const ni = Math.max(0, next);
      setCursor(ni);
      const w = queue[ni];
      if (w) {
        setCurrentStatus(w.status || '');
        setFamiliarity(FAMILIARITY_MAP[w.status || ''] ?? 50);
      } else {
        setCurrentStatus('');
      }
      loadCounts();
    } else {
      setFinishing(true);
    }
  };

  useEffect(() => {
    if (!finishing) return;
    const t = setTimeout(() => {
      router.back();
    }, 400);
    return () => clearTimeout(t);
  }, [finishing, router]);

  const checkGrammar = () => {
    Alert.alert('提示', '高中词汇的"语法检测"在此功能尚未接入，如需可在后续版本提供。');
  };

  return (
    <Screen>
      <View style={styles.container}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.backText}>← 返回</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>四级单词</Text>
            <View style={styles.placeholder} />
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#4F46E5" />
            </View>
          ) : (
            <>
              {/* Word Card */}
              <View style={styles.wordCard}>
                <Text style={styles.wordText}>{currentWord.word}</Text>
                {currentWord.phonetic ? <Text style={styles.phoneticText}>{currentWord.phonetic}</Text> : null}
              </View>

              {/* Meaning */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>词义</Text>
                <Text style={styles.meaningText}>{currentWord.meaning}</Text>
              </View>

              {/* Drop Zones */}
              <View style={styles.dropZonesContainer}>
                <Text style={styles.dropZoneHint}>点击状态按钮完成记忆分类，自动进入下一单词</Text>
                <View style={styles.dropZones}>
                  {CATEGORIES.map((c, i) => {
                    const count =
                      i === 0 ? categoryCounts.known : i === 1 ? categoryCounts.vague : categoryCounts.unknown;
                    const active = currentStatus === c.status;
                    return (
                      <TouchableOpacity
                        key={c.status}
                        style={[styles.dropZone, { backgroundColor: c.color }, active && styles.dropZoneActive]}
                        onPress={() => classify(c.status)}
                      >
                        <Text style={styles.dropZoneText}>{c.label}</Text>
                        <Text style={styles.dropZoneCount}>({count})</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Familiarity Slider */}
              <View style={styles.sliderSection}>
                <Text style={styles.sliderLabel}>熟悉度：{familiarity}%</Text>
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderMinText}>最不熟悉</Text>
                  <Text style={styles.sliderMaxText}>最熟悉</Text>
                </View>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={100}
                  value={familiarity}
                  onValueChange={(value) => setFamiliarity(Math.round(value))}
                  minimumTrackTintColor="#4CAF50"
                  maximumTrackTintColor="#E0E0E0"
                  thumbTintColor="#4CAF50"
                />
              </View>

              {/* Comments Section */}
              <View style={styles.commentsSection}>
                <Text style={styles.commentsLabel}>写作&笔记 (0)</Text>
                <View style={styles.commentInputContainer}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="写下你的句子..."
                    placeholderTextColor="#999"
                    value={commentText}
                    onChangeText={setCommentText}
                    multiline
                    maxLength={500}
                  />
                  <TouchableOpacity style={styles.submitButton} onPress={checkGrammar}>
                    <Text style={styles.submitButtonText}>语法检测</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.noComments}>暂无笔记，来写点什么吧</Text>
              </View>

              {finishing && (
                <Text style={styles.finishingText}>全部单词已分类完成</Text>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  backText: { fontSize: 14, color: '#666666', fontFamily: 'serif' },
  headerTitle: { fontSize: 16, color: '#333333', fontFamily: 'serif', fontWeight: '600' },
  placeholder: { width: 50 },
  content: { flex: 1 },
  loadingBox: { padding: 48, alignItems: 'center' },
  wordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 20,
    marginVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  wordText: { fontSize: 28, fontWeight: '700', color: '#333333', fontFamily: 'Times New Roman', textAlign: 'center' },
  phoneticText: { fontSize: 18, color: '#666666', fontFamily: 'Times New Roman', marginTop: 8, textAlign: 'center' },
  section: { paddingHorizontal: 20, paddingVertical: 16 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#333333', fontFamily: 'serif', marginBottom: 8 },
  meaningText: { fontSize: 14, color: '#333333', fontFamily: 'serif', lineHeight: 22 },
  dropZonesContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#F8F8F8',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  dropZoneHint: { fontSize: 12, color: '#999', textAlign: 'center', marginBottom: 12, fontFamily: 'serif' },
  dropZones: { flexDirection: 'row', justifyContent: 'space-between' },
  dropZone: {
    flex: 1,
    marginHorizontal: 6,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dropZoneActive: { borderColor: '#333333' },
  dropZoneText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', fontFamily: 'serif' },
  dropZoneCount: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 4, fontFamily: 'serif' },
  sliderSection: { paddingHorizontal: 20, paddingVertical: 16 },
  sliderLabel: { fontSize: 14, fontWeight: '600', color: '#333333', fontFamily: 'serif', marginBottom: 8 },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  sliderMinText: { fontSize: 12, color: '#999999', fontFamily: 'serif' },
  sliderMaxText: { fontSize: 12, color: '#999999', fontFamily: 'serif' },
  slider: { width: '100%', height: 40 },
  commentsSection: { paddingHorizontal: 20, paddingVertical: 16 },
  commentsLabel: { fontSize: 14, fontWeight: '600', color: '#333333', fontFamily: 'serif', marginBottom: 12 },
  commentInputContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  commentInput: { fontSize: 14, color: '#333333', fontFamily: 'serif', minHeight: 60, textAlignVertical: 'top' },
  submitButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'flex-end',
    marginTop: 10,
  },
  submitButtonText: { fontSize: 14, color: '#FFFFFF', fontWeight: '600', fontFamily: 'serif' },
  noComments: { fontSize: 13, color: '#999999', fontFamily: 'serif', textAlign: 'center', paddingVertical: 12 },
  finishingText: { fontSize: 14, color: '#4F46E5', fontWeight: '600', textAlign: 'center', paddingVertical: 16 },
});