import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { fetchWithRetry } from '@/utils/apiClient';

interface Word {
  id: number;
  word: string;
  meaning: string;
  phonetic?: string;
}

const CATEGORIES = [
  { status: 'known', label: '已会', color: '#4CAF50' },
  { status: 'vague', label: '模糊', color: '#FF9800' },
  { status: 'unknown', label: '不会', color: '#F44336' },
];

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
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);

  const currentWord: Word = cursor >= 0 && queue[cursor] ? queue[cursor] : initialWord;

  const loadQueue = useCallback(async () => {
    try {
      const res = await fetchWithRetry('/api/v1/sijicihui-study/words?status=&page=1&limit=200');
      const json = await res.json();
      if (json?.success && Array.isArray(json.data)) {
        setQueue(json.data as Word[]);
        const idx = json.data.findIndex((w: any) => w.id === initialWord.id);
        setCursor(idx);
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

    // 分类成功 → 跳到下一个待学习单词
    const next = cursor + 1;
    if (cursor === -1 || next < queue.length) {
      setCursor(Math.max(0, next));
      setCurrentStatus('');
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

  return (
    <Screen>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>单词详情</Text>
          <View style={styles.placeholder} />
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#9CA3AF" />
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.wordText}>{currentWord.word}</Text>
              {currentWord.phonetic ? <Text style={styles.phoneticText}>{currentWord.phonetic}</Text> : null}
              <Text style={styles.meaningText}>{currentWord.meaning}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>记忆状态</Text>
              <View style={styles.categoryRow}>
                {CATEGORIES.map((c) => {
                  const active = currentStatus === c.status;
                  return (
                    <TouchableOpacity
                      key={c.status}
                      style={[
                        styles.categoryButton,
                        { backgroundColor: active ? c.color : c.color + '26', borderColor: c.color, borderWidth: active ? 2 : 1 },
                      ]}
                      onPress={() => classify(c.status)}
                    >
                      <Text style={[styles.categoryLabel, { color: active ? '#FFFFFF' : c.color }]}>
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.nextHint}>
                {finishing ? '全部单词已分类完成' : '点击状态后自动跳转下一单词'}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#D8D8D8' },
  backText: { fontSize: 14, color: '#666666', fontFamily: 'serif' },
  title: { fontSize: 16, color: '#666666', fontFamily: 'serif', fontWeight: '600' },
  placeholder: { width: 50 },
  loadingBox: { padding: 40, alignItems: 'center' },
  card: { padding: 28, alignItems: 'center' },
  wordText: { fontSize: 34, fontWeight: '800', color: '#1F2937', textAlign: 'center' },
  phoneticText: { fontSize: 16, color: '#6B7280', marginTop: 8 },
  meaningText: { fontSize: 16, color: '#3B82F6', marginTop: 16, textAlign: 'center', lineHeight: 26 },
  section: { paddingHorizontal: 20, paddingTop: 8 },
  sectionLabel: { fontSize: 15, color: '#9CA3AF', marginBottom: 12 },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  categoryButton: { flex: 1, marginHorizontal: 6, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  categoryLabel: { fontSize: 15, fontWeight: '600' },
  nextHint: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 14 },
});