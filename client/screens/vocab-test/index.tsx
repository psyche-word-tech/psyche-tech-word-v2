import { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { fetchWithRetry } from '@/utils/apiClient';

interface TestWord {
  id: number;
  word: string;
  level: string;
}

interface Answer {
  word: string;
  known: boolean;
}

export default function VocabTestPage() {
  const router = useSafeRouter();
  const [phase, setPhase] = useState<'idle' | 'loading' | 'testing' | 'submitting' | 'done'>('idle');
  const [words, setWords] = useState<TestWord[]>([]);
  const [total, setTotal] = useState(0);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const reqRef = useRef<AbortController | null>(null);

  const startTest = async () => {
    setError('');
    reqRef.current?.abort();
    const controller = new AbortController();
    reqRef.current = controller;
    setPhase('loading');
    try {
      const [statsRes, testRes] = await Promise.all([
        fetchWithRetry(`/api/v1/gk-vocab/stats`, { signal: controller.signal }),
        fetchWithRetry(`/api/v1/gk-vocab/test?limit=30`, { signal: controller.signal }),
      ]);
      if (!statsRes.ok || !testRes.ok) throw new Error(`HTTP ${statsRes.status || testRes.status}`);
      const stats = await statsRes.json();
      const test = await testRes.json();
      if (!test.words || test.words.length === 0) throw new Error('词库为空');
      setTotal(stats.total || test.total || 0);
      setWords(test.words);
      setAnswers([]);
      setIndex(0);
      setPhase('testing');
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setError(e?.message || '加载失败，请稍后重试');
      setPhase('idle');
    }
  };

  const choose = useCallback((known: boolean) => {
    if (phase !== 'testing' || index >= words.length) return;
    const w = words[index];
    setAnswers((prev) => [...prev, { word: w.word, known }]);
    if (index + 1 >= words.length) {
      submitTest([...answers, { word: w.word, known }]);
    } else {
      setIndex(index + 1);
    }
  }, [phase, index, words, answers]);

  const submitTest = async (ans: Answer[]) => {
    setPhase('submitting');
    try {
      const res = await fetchWithRetry(`/api/v1/gk-vocab/test/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: ans }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
      setPhase('done');
    } catch (e: any) {
      setError(e?.message || '提交失败，请重试');
      setPhase('testing');
    }
  };

  const renderIdle = () => (
    <View style={styles.center}>
      <Text style={styles.introTitle}>高中英语 · 词汇量测试</Text>
      <Text style={styles.introText}>随机抽 30 个高中英语课程标准的单词，</Text>
      <Text style={styles.introText}>如实勾选你是否认识，即可估算你的词汇量。</Text>
      <Text style={styles.introText}>（词表共 {total || '--'} 词）</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={styles.primaryBtn} onPress={startTest}>
        <Text style={styles.primaryBtnText}>开始测试</Text>
      </TouchableOpacity>
    </View>
  );

  const renderLoading = () => (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#4CAF50" />
      <Text style={styles.loadingText}>正在抽取单词...</Text>
    </View>
  );

  const w = words[index];
  const renderTesting = () => (
    <View style={styles.testWrap}>
      <Text style={styles.progress}>{index + 1} / {words.length}</Text>
      <View style={styles.wordCard}>
        <Text style={styles.wordText}>{w?.word}</Text>
        <Text style={styles.hintText}>你认识这个单词吗？</Text>
      </View>
      <View style={styles.choices}>
        <TouchableOpacity style={[styles.choice, { backgroundColor: '#4CAF50' }]} onPress={() => choose(true)}>
          <Text style={styles.choiceText}>认识</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.choice, { backgroundColor: '#FFB300' }]} onPress={() => choose(false)}>
          <Text style={styles.choiceText}>模糊</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.choice, { backgroundColor: '#F44336' }]} onPress={() => choose(false)}>
          <Text style={styles.choiceText}>不认识</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSubmitting = () => (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#4CAF50" />
      <Text style={styles.loadingText}>正在估算词汇量...</Text>
    </View>
  );

  const renderDone = () => (
    <ScrollView style={styles.resultWrap} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.resultTitle}>测试完成</Text>
      <View style={styles.resultCard}>
        <Text style={styles.resultEstimate}>{result?.estimated_vocab ?? '--'}</Text>
        <Text style={styles.resultLabel}>估算词汇量（词）</Text>
      </View>
      <View style={styles.resultRow}>
        <Text style={styles.resultRowText}>词库总量：{result?.total ?? total} 词</Text>
      </View>
      <View style={styles.resultRow}>
        <Text style={styles.resultRowText}>抽样 {result?.sample_count ?? 0} 词，认识 {result?.known_count ?? 0} 词</Text>
      </View>
      <Text style={styles.resultTip}>认识率 {result?.sample_count ? Math.round((result.known_count / result.sample_count) * 100) : 0}%，按比例估算全部词库。</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={styles.primaryBtn} onPress={startTest}>
        <Text style={styles.primaryBtnText}>再测一次</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace('/my-vocabulary')}>
        <Text style={styles.secondaryBtnText}>返回词汇书</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/my-vocabulary')}>
            <Text style={styles.backText}>← back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>词汇量测试</Text>
          <View style={{ width: 60 }} />
        </View>
        {phase === 'idle' && renderIdle()}
        {phase === 'loading' && renderLoading()}
        {phase === 'testing' && renderTesting()}
        {phase === 'submitting' && renderSubmitting()}
        {phase === 'done' && renderDone()}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, backgroundColor: '#D8D8D8',
  },
  backText: { fontSize: 14, color: '#666666', fontFamily: 'serif' },
  title: { fontSize: 16, color: '#666666', fontFamily: 'serif', fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  introTitle: { fontSize: 18, color: '#333333', fontFamily: 'serif', fontWeight: '600', marginBottom: 16 },
  introText: { fontSize: 14, color: '#666666', fontFamily: 'serif', lineHeight: 22, textAlign: 'center' },
  error: { fontSize: 12, color: '#F44336', fontFamily: 'monospace', marginTop: 12, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: '#4CAF50', paddingHorizontal: 32, paddingVertical: 12,
    borderRadius: 24, marginTop: 24,
  },
  primaryBtnText: { fontSize: 15, color: '#FFFFFF', fontFamily: 'serif', fontWeight: '600' },
  secondaryBtn: { marginTop: 12, paddingHorizontal: 24, paddingVertical: 10 },
  secondaryBtnText: { fontSize: 14, color: '#4CAF50', fontFamily: 'serif' },
  loadingText: { fontSize: 14, color: '#999999', fontFamily: 'serif', marginTop: 12 },
  testWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  progress: { fontSize: 13, color: '#999999', fontFamily: 'serif', marginBottom: 32 },
  wordCard: {
    backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 40, paddingVertical: 48,
    alignItems: 'center', minWidth: '100%',
  },
  wordText: { fontSize: 40, color: '#333333', fontFamily: 'serif', fontWeight: '700' },
  hintText: { fontSize: 13, color: '#999999', fontFamily: 'serif', marginTop: 16 },
  choices: { marginTop: 40, width: '100%' },
  choice: {
    borderRadius: 24, paddingVertical: 14, alignItems: 'center', marginBottom: 14,
  },
  choiceText: { fontSize: 15, color: '#FFFFFF', fontFamily: 'serif', fontWeight: '600' },
  resultWrap: { flex: 1, padding: 24 },
  resultTitle: { fontSize: 18, color: '#333333', fontFamily: 'serif', fontWeight: '600', textAlign: 'center', marginBottom: 20 },
  resultCard: {
    backgroundColor: '#F5F5F5', borderRadius: 12, alignItems: 'center', paddingVertical: 28, marginBottom: 16,
  },
  resultEstimate: { fontSize: 44, color: '#4CAF50', fontFamily: 'serif', fontWeight: '700' },
  resultLabel: { fontSize: 13, color: '#999999', fontFamily: 'serif', marginTop: 4 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  resultRowText: { fontSize: 14, color: '#333333', fontFamily: 'serif' },
  resultTip: { fontSize: 12, color: '#999999', fontFamily: 'serif', marginTop: 8, marginBottom: 16, lineHeight: 18 },
});