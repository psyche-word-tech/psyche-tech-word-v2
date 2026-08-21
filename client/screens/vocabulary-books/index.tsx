import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { getApiBaseUrl } from '@/utils/apiConfig';
import { useAuth } from '@/contexts/AuthContext';

interface VocabularyBook {
  id: string;
  name: string;
  cover?: string;
  wordCount: number;
  learnedCount: number;
  category: string;
}

export default function VocabularyBooksScreen() {
  const router = useSafeRouter();
  const { user } = useAuth();
  const [books, setBooks] = useState<VocabularyBook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/wordbooks`, {
        headers: {
          'Authorization': `Bearer ${user?.token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setBooks(data.books || []);
      }
    } catch (error) {
      console.error('加载词汇书失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, color: '#666' }}>加载中...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="我的词汇书" />
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
        {books.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Ionicons name="book-outline" size={64} color="#ccc" />
            <Text style={{ fontSize: 16, color: '#999', marginTop: 16 }}>暂无词汇书</Text>
            <TouchableOpacity
              onPress={() => router.push('/vocabulary')}
              style={{
                marginTop: 24,
                paddingHorizontal: 24,
                paddingVertical: 12,
                backgroundColor: '#3b82f6',
                borderRadius: 8,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 14 }}>去选购</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {books.map((book) => (
              <TouchableOpacity
                key={book.id}
                onPress={() => router.push('/word-list', { bookId: book.id })}
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 12,
                  padding: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              >
                {book.cover ? (
                  <Image
                    source={{ uri: book.cover }}
                    style={{ width: 60, height: 80, borderRadius: 8, marginRight: 16 }}
                  />
                ) : (
                  <View
                    style={{
                      width: 60,
                      height: 80,
                      borderRadius: 8,
                      backgroundColor: '#e5e7eb',
                      marginRight: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="book" size={32} color="#9ca3af" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 4 }}>
                    {book.name}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
                    {book.category}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ flex: 1, height: 6, backgroundColor: '#e5e7eb', borderRadius: 3 }}>
                      <View
                        style={{
                          width: `${(book.learnedCount / book.wordCount) * 100}%`,
                          height: '100%',
                          backgroundColor: '#3b82f6',
                          borderRadius: 3,
                        }}
                      />
                    </View>
                    <Text style={{ fontSize: 12, color: '#6b7280' }}>
                      {book.learnedCount}/{book.wordCount}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
