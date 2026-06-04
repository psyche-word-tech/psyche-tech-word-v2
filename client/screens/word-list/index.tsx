import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { API_BASE_URL } from '@/utils/apiConfig';

const EXPO_PUBLIC_BACKEND_BASE_URL = API_BASE_URL;

interface Word {
  id: number;
  word: string;
  meaning: string;
  phonetic?: string;
  example?: string;
  example_translation?: string;
  image_url?: string;
}

export default function WordListPage() {
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ table?: string }>();
  const table = params.table || 'b';

  const [words, setWords] = useState<Word[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      const fetchWords = async () => {
        try {
          const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/wordbooks/${table}`);
          const data = await response.json();
          if (Array.isArray(data)) {
            setWords(data);
          }
        } catch (error) {
          console.error('Failed to fetch words:', error);
        }
      };
      fetchWords();
    }, [table])
  );

  const filteredWords = words.filter(word => 
    word.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
    word.meaning.includes(searchQuery)
  );

  const handleWordPress = (word: Word) => {
    router.push('/word-detail', {
      word: JSON.stringify({
        id: word.id,
        word: word.word,
        phonetic: word.phonetic || '',
        meaning: word.meaning,
        example: word.example || '',
        example_translation: word.example_translation || '',
        image_url: word.image_url || ''
      }),
      table: table
    });
  };

  return (
    <Screen>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>单词列表</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="搜索单词..."
            placeholderTextColor="#999999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Word List */}
        <ScrollView style={styles.listContainer}>
          {filteredWords.length > 0 ? (
            filteredWords.map((word) => (
              <TouchableOpacity
                key={word.id}
                style={styles.wordItem}
                onPress={() => handleWordPress(word)}
              >
                <View style={styles.wordRow}>
                  <Text style={styles.wordText}>{word.word}</Text>
                  {word.phonetic && (
                    <Text style={styles.phoneticText}>{word.phonetic}</Text>
                  )}
                </View>
                <Text style={styles.meaningText}>{word.meaning}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchQuery ? '未找到匹配的单词' : '暂无单词'}
              </Text>
            </View>
          )}
        </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  backText: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'serif',
  },
  title: {
    fontSize: 16,
    color: '#333333',
    fontFamily: 'serif',
    fontWeight: '600',
  },
  placeholder: {
    width: 50,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',

  },
  searchInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333333',
    fontFamily: 'serif',
  },
  listContainer: {
    flex: 1,
    padding: 16,
  },
  wordItem: {
    backgroundColor: '#FAFAFA',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,

  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  wordText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    fontFamily: 'serif',
  },
  phoneticText: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'Times New Roman',
    marginLeft: 8,
  },
  meaningText: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'serif',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: '#999999',
    fontFamily: 'serif',
  },
});
