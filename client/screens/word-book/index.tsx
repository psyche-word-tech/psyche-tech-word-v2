import { View, Text, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { getApiBaseUrl } from '@/utils/apiConfig';
import { useAuth } from '@/contexts/AuthContext';

interface WordItem {
  id: string;
  word: string;
  phonetic?: string;
  meaning?: string;
  addedAt: string;
}

export default function WordBookScreen() {
  const router = useSafeRouter();
  const { user } = useAuth();
  const [words, setWords] = useState<WordItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWords();
  }, []);

  const loadWords = async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/user-words`, {
        headers: {
          'Authorization': `Bearer ${user?.token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setWords(data.words || []);
      }
    } catch (error) {
      console.error('加载生词本失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderWordItem = ({ item }: { item: WordItem }) => (
    <TouchableOpacity
      onPress={() => router.push('/word-detail', { word: item.word })}
      style={{
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#1f2937', marginBottom: 4 }}>
            {item.word}
          </Text>
          {item.phonetic && (
            <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>
              {item.phonetic}
            </Text>
          )}
          {item.meaning && (
            <Text style={{ fontSize: 14, color: '#374151' }} numberOfLines={2}>
              {item.meaning}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
      </View>
      <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
        添加于 {new Date(item.addedAt).toLocaleDateString('zh-CN')}
      </Text>
    </TouchableOpacity>
  );

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
      <Header title="生词本" />
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
        {words.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Ionicons name="bookmark-outline" size={64} color="#ccc" />
            <Text style={{ fontSize: 16, color: '#999', marginTop: 16 }}>生词本为空</Text>
            <Text style={{ fontSize: 14, color: '#bbb', marginTop: 8 }}>
              学习时遇到的生词会自动添加到这里
            </Text>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ fontSize: 14, color: '#6b7280' }}>
                共 {words.length} 个单词
              </Text>
              <TouchableOpacity>
                <Text style={{ fontSize: 14, color: '#3b82f6' }}>批量管理</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={words}
              renderItem={renderWordItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
