import { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, TextInput, Modal } from 'react-native';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { fetchWithRetry } from '@/utils/apiClient';
import { getApiBaseUrl } from '@/utils/apiConfig';
import { useAuth } from '@/contexts/AuthContext';

const TEST_LIMIT = 120;
const PER_RATIOS = '基础30% · 必修35% · 选必35%';

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
  const { user, updateUser } = useAuth();
  const [phase, setPhase] = useState<'idle' | 'loading' | 'testing' | 'submitting' | 'name' | 'done'>('idle');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<Record<number, string>>({});
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const reqRef = useRef<AbortController | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [nameError, setNameError] = useState('');

  const startTest = async () => {
    setError('');
    reqRef.current?.abort();
    const controller = new AbortController();
    reqRef.current = controller;
    setPhase('loading');
    try {
      const res = await fetchWithRetry(`/api/v1/gk-vocab/test?total=${TEST_LIMIT}`, { signal: controller.signal });
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

  const pick = useCallback(
    (q: Question, option: string) => {
      const next = { ...chosen, [q.id]: option };
      setChosen(next);
      if (index + 1 < questions.length) {
        setTimeout(() => setIndex(index + 1), 160);
      } else {
        const answers: Answer[] = questions.map((qq) => ({ id: qq.id, chosen: next[qq.id] }));
        setTimeout(() => submitTest(answers), 160);
      }
    },
    [chosen, index, questions],
  );

  const submitTest = async (answers: Answer[]) => {
    setError('');
    setPhase('submitting');
    try {
      const res = await fetchWithRetry(`/api/v1/gk-vocab/test/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, user_id: user?.id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
      if (user?.token && (!user.username || !user.username.trim())) {
        setNameDraft('');
        setNameError('');
        setPhase('name');
      } else {
        setPhase('done');
      }
    } catch (e: any) {
      setError(e?.message || '提交失败，请重试');
      setPhase('testing');
    }
  };

  const saveName = async () => {
    const name = nameDraft.trim();
    if (!name) {
      setNameError('请输入你的姓名');
      return;
    }
    if (name.length > 30) {
      setNameError('姓名最多 30 个字符');
      return;
    }
    setNameError('');
    setError('');
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/user/update-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user?.token}` },
        body: JSON.stringify({ username: name }),
      });
      const data = await res.json();
      if (data.success) {
        updateUser({ username: name });
        setPhase('done');
      } else {
        setNameError(data.error || '姓名保存失败，请重试');
      }
    } catch (e: any) {
      setNameError('姓名保存失败，请重试');
    }
  };

  const renderName = () => (
    <View style={styles.center}>
      <Text style={styles.introTitle}>请输入你的姓名</Text>
      <TextInput
        style={styles.nameInput}
        placeholder="你的姓名"
        placeholderTextColor="#BBBBBB"
        value={nameDraft}
        onChangeText={(t) => setNameDraft(t)}
      />
      {nameError ? <Text style={styles.error}>{nameError}</Text> : null}
      <TouchableOpacity style={styles.primaryBtn} onPress={saveName}>
        <Text style={styles.primaryBtnText}>查看测试结果</Text>
      </TouchableOpacity>
    </View>
  );

  const renderIdle = () => (
    <View style={styles.center}>
      <Text style={styles.introTitle}>高中英语 · 词汇量测试</Text>
      <Text style={styles.introText}>按基础 / 必修 / 选修三类分别抽取词汇，</Text>
      <Text style={styles.introText}>基础 {PER_RATIOS} · 共 {TEST_LIMIT} 题。</Text>
      <Text style={styles.introText}>每题从 5 个中文意思中选出正确的一个，</Text>
      <Text style={styles.introText}>选对才算对，分项估算各类识别率与总体词汇量。</Text>
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
      <Text style={styles.hintText}>点选中文意思，选后自动进入下一题</Text>
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
      </View>
    </ScrollView>
  );

  const renderSubmitting = () => (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#4CAF50" />
      <Text style={styles.loadingText}>正在估算词汇量...</Text>
    </View>
  );

  const renderDone = () => {
    const levels = result?.levels || {};
    const rate = (lv: any) => (lv?.sample ? Math.round(lv.rate * 100) : 0);
    return (
      <ScrollView style={styles.resultWrap} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.resultTitle}>测试报告</Text>
        <View style={styles.resultCard}>
          <Text style={styles.resultEstimate}>{result?.estimated_vocab ?? '--'}</Text>
          <Text style={styles.resultLabel}>总体词汇量（词）</Text>
        </View>
        <View style={styles.levelCard}>
          <Text style={styles.levelName}>基础词识别率</Text>
          <Text style={styles.levelRate}>{rate(levels.base)}%</Text>
          <Text style={styles.levelSub}>答对 {levels.base?.correct ?? 0} / {levels.base?.sample ?? 0}（词池 {levels.base?.total ?? 0}）</Text>
        </View>
        <View style={styles.levelCard}>
          <Text style={styles.levelName}>必修词识别率</Text>
          <Text style={styles.levelRate}>{rate(levels.required)}%</Text>
          <Text style={styles.levelSub}>答对 {levels.required?.correct ?? 0} / {levels.required?.sample ?? 0}（词池 {levels.required?.total ?? 0}）</Text>
        </View>
        <View style={styles.levelCard}>
          <Text style={styles.levelName}>选修词识别率</Text>
          <Text style={styles.levelRate}>{rate(levels.elective)}%</Text>
          <Text style={styles.levelSub}>答对 {levels.elective?.correct ?? 0} / {levels.elective?.sample ?? 0}（词池 {levels.elective?.total ?? 0}）</Text>
        </View>
        <Text style={styles.resultTip}>总体词汇量 = 基础 / 必修 / 选修识别率分别乘各词池大小后求和估算。</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity style={styles.primaryBtn} onPress={startTest}>
          <Text style={styles.primaryBtnText}>再测一次</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace('/my-vocabulary')}>
          <Text style={styles.secondaryBtnText}>返回词汇书</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

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
        {phase === 'name' && renderName()}
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
  nameInput: {
    borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10,
    width: '80%', marginTop: 20, fontSize: 16, color: '#333333', fontFamily: 'serif',
  },
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
  levelCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E0E0E0',
    paddingVertical: 16, paddingHorizontal: 18, marginBottom: 12,
  },
  levelName: { fontSize: 15, color: '#333333', fontFamily: 'serif', fontWeight: '600' },
  levelRate: { fontSize: 28, color: '#4CAF50', fontFamily: 'serif', fontWeight: '700', marginTop: 6 },
  levelSub: { fontSize: 12, color: '#999999', fontFamily: 'serif', marginTop: 6 },
});