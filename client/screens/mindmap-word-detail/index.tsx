import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { Ionicons } from '@expo/vector-icons';

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

export default function MindmapWordDetailPage() {
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ word?: string }>();
  const [word, setWord] = useState<Word | null>(null);

  useEffect(() => {
    if (params.word) {
      try {
        const parsed = JSON.parse(params.word);
        setWord(parsed);
      } catch (e) {
        console.error('Failed to parse word data:', e);
      }
    }
  }, [params.word]);

  if (!word) {
    return (
      <Screen>
        <View style={styles.container}>
          <Text style={styles.errorText}>无法加载单词数据</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333333" />
          </TouchableOpacity>
          <Text style={styles.title}>单词详情</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Word Section */}
          <View style={styles.section}>
            <Text style={styles.wordText}>{word.word}</Text>
            {word.phonetic && (
              <Text style={styles.phoneticText}>{word.phonetic}</Text>
            )}
          </View>

          {/* Meaning Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>释义</Text>
            <Text style={styles.meaningText}>{word.meaning}</Text>
          </View>

          {/* Noun Phrase Section */}
          {word.noun_phrase && (
            <>
              <View style={styles.divider} />
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>名词短语</Text>
                <Text style={styles.phraseText}>{word.noun_phrase}</Text>
                {word.phrase_phonetic && (
                  <Text style={styles.phrasePhonetic}>{word.phrase_phonetic}</Text>
                )}
                {word.phrase_translation && (
                  <Text style={styles.phraseTransText}>{word.phrase_translation}</Text>
                )}
              </View>
            </>
          )}

          {/* Phrase Image */}
          {word.phrase_image_url && (
            <View style={styles.imageSection}>
              <Text style={styles.sectionTitle}>配图</Text>
              <Image
                source={{ uri: word.phrase_image_url }}
                style={styles.phraseImage}
                resizeMode="cover"
              />
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
  title: {
    fontSize: 18,
    color: '#333333',
    fontFamily: 'serif',
    fontWeight: '600',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    color: '#999999',
    fontFamily: 'serif',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  wordText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1F2937',
    fontFamily: 'serif',
  },
  phoneticText: {
    fontSize: 18,
    color: '#666666',
    fontFamily: 'Times New Roman',
    marginTop: 4,
  },
  meaningText: {
    fontSize: 16,
    color: '#333333',
    fontFamily: 'serif',
    lineHeight: 24,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginVertical: 20,
  },
  phraseText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#4F46E5',
    fontFamily: 'serif',
  },
  phrasePhonetic: {
    fontSize: 16,
    color: '#666666',
    fontFamily: 'Times New Roman',
    marginTop: 4,
  },
  phraseTransText: {
    fontSize: 16,
    color: '#333333',
    fontFamily: 'serif',
    marginTop: 8,
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
  },
  imageSection: {
    marginTop: 16,
  },
  phraseImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  errorText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginTop: 60,
    fontFamily: 'serif',
  },
});
