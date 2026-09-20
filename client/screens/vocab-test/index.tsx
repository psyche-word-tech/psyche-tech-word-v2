import { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { fetchWithRetry } from '@/utils/apiClient';

const TEST_LIMIT = 120;

interface Question {
  id: number;
  word: string;
  level: string;
  variant: string | null;
  options: string[];
}

interface Answer {
  id: number;
  chosen: string;
}

export default function VocabTestPage() {
  const router = useSafeRouter();
  const [phase, setPhase] = useState<'idle' | 'loading' | 'testing' | 'submitting' | 'done'>('idle');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<Record<number, string>>({});
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
      const res = await fetchWithRetry(`/api/v1/gk-vocab/test?limit=${TEST_LIMIT}`, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const test = await res.json();
      if (!test.questions || test.questions.length === 0) throw new Error('词库为空');
      setTotal(test.total || 0);
      setQuestions(test.questions);
      setChosen({});
      setIndex(0);
      setPhase('testing');
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setError(e?.message || '加载失败，请稍后重试');
      setPhase('idle');
    }
  };

  const pick = useCallback((q: Question, option: string) => {
    setChosen((prev) => ({ ...prev, [q.id]: option }));
  }, []);

  const submitTest = async () => {
    const unanswered = questions.filter((q) => !chosen[q.id]);
    if (unanswered.length > 0) {
      setError(`还有 ${unanswered.length} 题未作答`);
      return;
    }
    setError('');
    const answers: Answer[] = questions.map((q) => ({ id: q.id, chosen: chosen[q.id] }));
    setPhase('submitting');
    try {
      const res = await fetchWithRetry(`/api/v1/gk-vocab/test/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
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
      <Text style={styles.introText}>随机抽取 {TEST_LIMIT} 个高中课标英语单词，</Text>
      <Text style={styles.introText}>每题从 5 个中文意思中选出正确的一个，</Text>
      <Text style={styles.introText}>选对才算对，据此估算你的词汇量。</Text>
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

  const q = questions[index];
  const myChoice = q ? chosen[q.id] : undefined;

  const renderTesting = () => (
    <ScrollView style={styles.testScroll} contentContainerStyle={styles.testWrap}>
      <Text style={styles.progress}>第 {index + 1} / {questions.length} 题</Text>
      <Text style={styles.levelBadge}>{q?.level === 'elective' ? '选择性必修' : q?.level === 'required' ? '必修' : '基础'}</Text>
      <View style={styles.wordCard}>
        <Text style={styles.wordText}>{q?.word}</Text>
      </View>
      <Text style={styles.hintText}>选出与单词相符的中文意思</Text>
      <View style={styles.choices}>
        {q?.options.map((opt) => {
          const selected = myChoice === opt;
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.option, selected && styles.optionSelected]}
              onPress={() => pick(q, opt)}
            >
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                {opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.nav}>
        <TouchableOpacity
          style={[styles.navBtn, index === 0 && styles.navBtnDisabled]}
          disabled={index === 0}
          onPress={() => setIndex(index - 1)}
        >
          <Text style={styles.navBtnText}>上一题</Text>
        </TouchableOpacity>
        {index + 1 < questions.length ? (
          <TouchableOpacity
            style={[styles.navBtn, !myChoice && styles.navBtnDisabled]}
            disabled={!myChoice}
            onPress={() => setIndex(index + 1)}
          >
            <Text style={styles.navBtnText}>下一题</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.navBtn, styles.navBtnDone, !myChoice && styles.navBtnDisabled]}
            disabled={!myChoice}
            onPress={submitTest}
          >
            <Text style={styles.navBtnText}>提交测试</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
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
        <Text style={styles.resultRowText}>抽样 {result?.sample_count ?? 0} 词，答对 {result?.correct_count ?? 0} 词</Text>
      </View>
      <Text style={styles.resultTip}>正确率 {result?.sample_count ? Math.round((result.correct_count / result.sample_count) * 100) : 0}%，按比例估算全部词库。</Text>
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
  error: { fontSize: 12, color: '#F44336', fontFamily: 'monospace', marginTop: 10, textAlign: 'center' },
  primaryBtn: { backgroundColor: '#4CAF50', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 24, marginTop: 24 },
  primaryBtnText: { fontSize: 15, color: '#FFFFFF', fontFamily: 'serif', fontWeight: '600' },
  secondaryBtn: { marginTop: 12, paddingHorizontal: 24, paddingVertical: 10 },
  secondaryBtnText: { fontSize: 14, color: '#4CAF50', fontFamily: 'serif' },
  loadingText: { fontSize: 14, color: '#999999', fontFamily: 'serif', marginTop: 12 },
  testScroll: { flex: 1 },
  testWrap: { padding: 20, alignItems: 'center' },
  progress: { fontSize: 13, color: '#999999', fontFamily: 'serif', marginBottom: 12 },
  levelBadge: {
    fontSize: 12, color: '#FFFFFF', fontFamily: 'serif', backgroundColor: '#81C784',
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 16, overflow: 'hidden',
  },
  wordCard: {
    backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 40, paddingVertical: 40,
    alignItems: 'center', alignSelf: 'stretch',
  },
  wordText: { fontSize: 38, color: '#333333', fontFamily: 'serif', fontWeight: '700' },
  hintText: { fontSize: 13, color: '#999999', fontFamily: 'serif', marginTop: 20, marginBottom: 12 },
  choices: { width: '100%' },
  option: {
    borderRadius: 12, borderWidth: 1.5, borderColor: '#DDDDDD', paddingVertical: 13,
    paddingHorizontal: 14, marginBottom: 10, alignItems: 'center', backgroundColor: '#FFFFFF',
  },
  optionSelected: { borderColor: '#4CAF50', backgroundColor: '#E8F5E9' },
  optionText: { fontSize: 14, color: '#333333', fontFamily: 'serif', textAlign: 'center' },
  optionTextSelected: { color: '#2E7D32', fontWeight: '600' },
  nav: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, width: '100%' },
  navBtn: {
    backgroundColor: '#4CAF50', paddingHorizontal: 26, paddingVertical: 11,
    borderRadius: 22, marginHorizontal: 8, flex: 1, alignItems: 'center',
  },
  navBtnDone: { backgroundColor: '#2E7D32' },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText: { fontSize: 14, color: '#FFFFFF', fontFamily: 'serif', fontWeight: '600' },
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