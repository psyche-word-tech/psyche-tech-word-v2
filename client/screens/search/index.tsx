import { View, Text, TextInput, TouchableOpacity, Image, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useState, useEffect } from 'react';

interface SolveResult {
  subject?: string;
  question?: string;
  analysis?: string;
  solution?: string;
  answer?: string;
  tips?: string;
  error?: string;
}

export default function SearchScreen() {
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ imageUri?: string }>();
  const imageUri = params.imageUri || '';
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SolveResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (imageUri) {
      solveProblem(imageUri);
    }
  }, [imageUri]);

  const solveProblem = async (uri: string) => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(uri);
      const blob = await response.blob();

      const formData = new FormData();
      formData.append('image', {
        uri: Platform.OS === 'web' ? uri : uri,
        name: 'problem.jpg',
        type: blob.type || 'image/jpeg',
      } as any);

      const res = await fetch('/api/v1/solve-problem', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error('Solve problem error:', err);
      setResult({ error: '解析失败，请重试' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <TextInput
            style={styles.searchInput}
            placeholder="搜索单词..."
            placeholderTextColor="#999"
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={styles.content}>
          {/* Show selected image if available */}
          {imageUri.length > 0 && (
            <View style={styles.imageSection}>
              <Text style={styles.sectionTitle}>题目图片</Text>
              <Image source={{ uri: imageUri }} style={styles.selectedImage} resizeMode="contain" />
              <TouchableOpacity style={styles.retakeButton} onPress={() => router.back()}>
                <Ionicons name="refresh" size={18} color="#666" />
                <Text style={styles.retakeText}>重新选择</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Loading */}
          {loading && (
            <View style={styles.loadingSection}>
              <ActivityIndicator size="large" color="#4A90E2" />
              <Text style={styles.loadingText}>正在解析题目...</Text>
            </View>
          )}

          {/* Result */}
          {result && !loading && (
            <View style={styles.resultSection}>
              {result.error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={24} color="#FF6B6B" />
                  <Text style={styles.errorText}>{result.error}</Text>
                </View>
              ) : (
                <>
                  {result.subject && (
                    <View style={styles.subjectTag}>
                      <Text style={styles.subjectText}>{result.subject}</Text>
                    </View>
                  )}

                  {result.question && (
                    <View style={styles.resultBlock}>
                      <Text style={styles.blockTitle}>题目</Text>
                      <Text style={styles.blockContent}>{result.question}</Text>
                    </View>
                  )}

                  {result.analysis && (
                    <View style={styles.resultBlock}>
                      <Text style={styles.blockTitle}>解析</Text>
                      <Text style={styles.blockContent}>{result.analysis}</Text>
                    </View>
                  )}

                  {result.solution && (
                    <View style={styles.resultBlock}>
                      <Text style={styles.blockTitle}>解答</Text>
                      <Text style={styles.blockContent}>{result.solution}</Text>
                    </View>
                  )}

                  {result.answer && (
                    <View style={styles.answerBlock}>
                      <Text style={styles.answerTitle}>答案</Text>
                      <Text style={styles.answerContent}>{result.answer}</Text>
                    </View>
                  )}

                  {result.tips && (
                    <View style={styles.tipsBlock}>
                      <Text style={styles.tipsTitle}>💡 解题技巧</Text>
                      <Text style={styles.tipsContent}>{result.tips}</Text>
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {/* Empty State */}
          {!imageUri && !loading && !result && (
            <View style={styles.resultsPlaceholder}>
              <Ionicons name="search-outline" size={48} color="#DDD" />
              <Text style={styles.hintText}>输入单词或拍照搜索</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#333',
  },
  content: {
    flex: 1,
  },
  imageSection: {
    padding: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sectionTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  selectedImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
  },
  retakeText: {
    fontSize: 14,
    color: '#666',
  },
  loadingSection: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
  },
  resultSection: {
    padding: 16,
  },
  subjectTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  subjectText: {
    fontSize: 12,
    color: '#1976D2',
    fontWeight: '600',
  },
  resultBlock: {
    marginBottom: 20,
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  blockContent: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
  },
  answerBlock: {
    backgroundColor: '#F1F8E9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  answerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#33691E',
    marginBottom: 8,
  },
  answerContent: {
    fontSize: 16,
    fontWeight: '600',
    color: '#33691E',
  },
  tipsBlock: {
    backgroundColor: '#FFF8E1',
    padding: 16,
    borderRadius: 8,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F57F17',
    marginBottom: 8,
  },
  tipsContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#C62828',
  },
  resultsPlaceholder: {
    padding: 60,
    alignItems: 'center',
  },
  hintText: {
    marginTop: 16,
    fontSize: 14,
    color: '#999',
  },
};
