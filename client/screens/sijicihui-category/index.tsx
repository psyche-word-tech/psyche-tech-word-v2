import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { useFocusEffect } from 'expo-router';
import { fetchWithRetry } from '@/utils/apiClient';

interface Word {
  id: number;
  word: string;
  meaning: string;
  phonetic?: string;
}

interface Props {
  status: 'known' | 'vague' | 'unknown';
  title: string;
  color: string;
  emptyText: string;
  hint: string;
}

export default function SijicihuiCategoryList({ status, title, color, emptyText, hint }: Props) {
  const router = useSafeRouter();
  const [words, setWords] = useState<Word[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWords = async () => {
    try {
      const response = await fetchWithRetry(`/api/v1/sijicihui-study/words?status=${status}&limit=500`);
      const json = await response.json();
      if (json.success && Array.isArray(json.data)) {
        setWords(json.data.map((w: any) => ({ id: w.id, word: w.word, phonetic: w.phonetic, meaning: w.meaning })));
      }
    } catch (error) {
      console.error('Failed to fetch words:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWords();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchWords();
    }, [])
  );

  const handleWordPress = (word: Word) => {
    router.push('/sijicihui-word-detail', {
      word: JSON.stringify(word),
      status
    });
  };

  return (
    <Screen>
      <View style={styles.container}>
        <View style={[styles.header, { backgroundColor: color }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {words.length > 0 ? (
            words.map((word) => (
              <TouchableOpacity
                key={word.id}
                style={styles.wordItem}
                onPress={() => handleWordPress(word)}
              >
                <Text style={styles.wordText}>{word.word}</Text>
                <Text style={styles.meaningText}>{word.meaning}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{emptyText}</Text>
              <Text style={styles.emptyHint}>{hint}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  backText: { fontSize: 14, color: '#FFFFFF', fontFamily: 'serif' },
  title: { fontSize: 16, color: '#FFFFFF', fontFamily: 'serif', fontWeight: '600' },
  placeholder: { width: 50 },
  listContainer: { flex: 1, padding: 16 },
  wordItem: { backgroundColor: '#F5F5F5', padding: 16, borderRadius: 8, marginBottom: 12 },
  wordText: { fontSize: 16, fontWeight: '600', color: '#333333', fontFamily: 'serif', marginBottom: 4 },
  meaningText: { fontSize: 14, color: '#666666', fontFamily: 'serif' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 14, color: '#999999', fontFamily: 'serif', marginBottom: 8 },
  emptyHint: { fontSize: 12, color: '#CCCCCC', fontFamily: 'serif' },
});