import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Image } from 'react-native';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { API_BASE_URL } from '@/utils/apiConfig';

const EXPO_PUBLIC_BACKEND_BASE_URL = API_BASE_URL;

interface Word {
  id: number;
  word: string;
  phonetic?: string;
  meaning: string;
  noun_phrase?: string;
  phrase_translation?: string;
  phrase_phonetic?: string;
  phrase_image_url?: string;
}

export default function MindmapWordListPage() {
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ title?: string }>();
  const title = params.title || '单词列表';

  const [words, setWords] = useState<Word[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const fetchWords = async () => {
        setLoading(true);
        try {
          const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/mindmap`);
          const data = await response.json();
          if (Array.isArray(data)) {
            setWords(data);
          }
        } catch (error) {
          console.error('Failed to fetch words:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchWords();
    }, [])
  );

  const filteredWords = words.filter(word => 
    word.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
    word.meaning.includes(searchQuery)
  );

  const handleWordPress = (word: Word) => {
    router.push('/mindmap-word-detail', {
      word: JSON.stringify(word)
    });
  };

  return (
    <Screen>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
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
          {loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>加载中...</Text>
            </View>
          ) : filteredWords.length > 0 ? (
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
                {word.noun_phrase && (
                  <View style={styles.phraseContainer}>
                    <Text style={styles.phraseLabel}>短语:</Text>
                    <Text style={styles.phraseText}>{word.noun_phrase}</Text>
                    <Text style={styles.phraseTrans}>{word.phrase_translation}</Text>
                  </View>
                )}
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
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    padding: 4,
  },
  backText: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'serif',
  },
  title: {
    fontSize: 18,
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
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  wordText: {
    fontSize: 20,
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
    marginTop: 6,
    lineHeight: 20,
  },
  phraseContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  phraseLabel: {
    fontSize: 12,
    color: '#999999',
    fontFamily: 'serif',
  },
  phraseText: {
    fontSize: 16,
    color: '#4F46E5',
    fontFamily: 'serif',
    fontWeight: '500',
    marginTop: 2,
  },
  phraseTrans: {
    fontSize: 13,
    color: '#666666',
    fontFamily: 'serif',
    marginTop: 2,
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
