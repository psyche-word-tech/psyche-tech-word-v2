import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
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
  const [word] = useState<Word>(() => {
    if (params.word) {
      try { return JSON.parse(params.word); } catch { /* ignore */ }
    }
    return { id: 0, word: '', meaning: '', phonetic: '' };
  });
  const [currentStatus, setCurrentStatus] = useState<string>(params.status || '');

  const classify = async (status: string) => {
    try {
      const response = await fetchWithRetry(`/api/v1/sijicihui-study/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordId: word.id, status }),
      });
      if (response.ok) {
        setCurrentStatus(status);
      }
    } catch (e) {
      console.error('classify failed:', e);
    }
  };

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

        <View style={styles.card}>
          <Text style={styles.wordText}>{word.word}</Text>
          {word.phonetic ? <Text style={styles.phoneticText}>{word.phonetic}</Text> : null}
          <Text style={styles.meaningText}>{word.meaning}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>记忆状态</Text>
          <View style={styles.categoryRow}>
            {CATEGORIES.map((c) => {
              const active = currentStatus === c.status;
              return (
                <TouchableOpacity
                  key={c.status}
                  style={[styles.categoryButton, { backgroundColor: active ? c.color : '#EEEEEE' }]}
                  onPress={() => classify(c.status)}
                >
                  <Text style={[styles.categoryLabel, { color: active ? '#FFFFFF' : '#666666' }]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
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
  card: { padding: 28, alignItems: 'center' },
  wordText: { fontSize: 34, fontWeight: '800', color: '#1F2937', textAlign: 'center' },
  phoneticText: { fontSize: 16, color: '#6B7280', marginTop: 8 },
  meaningText: { fontSize: 16, color: '#3B82F6', marginTop: 16, textAlign: 'center', lineHeight: 26 },
  section: { paddingHorizontal: 20, paddingTop: 8 },
  sectionLabel: { fontSize: 15, color: '#9CA3AF', marginBottom: 12 },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  categoryButton: { flex: 1, marginHorizontal: 6, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  categoryLabel: { fontSize: 15, fontWeight: '600' },
});