import { View, Text, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { getApiBaseUrl } from '@/utils/apiConfig';
import { useAuth } from '@/contexts/AuthContext';

interface VocabularyBook {
  id: string;
  name: string;
  description: string;
  wordCount: number;
  learnedCount: number;
  cover: string;
  category: string;
}

export default function MyVocabularyBooksScreen() {
  const router = useSafeRouter();
  const { user } = useAuth();
  const [books, setBooks] = useState<VocabularyBook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/vocabulary-books`, {
        headers: {
          'Authorization': `Bearer ${user?.token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setBooks(data.data || []);
      }
    } catch (error) {
      console.error('加载词汇书失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { id: 'all', name: '全部', icon: 'grid' },
    { id: 'cet4', name: '四级', icon: 'book' },
    { id: 'cet6', name: '六级', icon: 'book' },
    { id: 'ielts', name: '雅思', icon: 'globe' },
    { id: 'toefl', name: '托福', icon: 'globe' },
    { id: 'gre', name: 'GRE', icon: 'school' },
  ];

  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredBooks = selectedCategory === 'all' 
    ? books 
    : books.filter(book => book.category === selectedCategory);

  const renderBookItem = ({ item }: { item: VocabularyBook }) => {
    const progress = item.wordCount > 0 ? (item.learnedCount / item.wordCount) * 100 : 0;
    
    return (
      <TouchableOpacity 
        className="bg-white rounded-2xl p-4 mb-3 shadow-sm"
        onPress={() => router.push({ pathname: '/vocabulary-book-detail', params: { id: item.id } })}
      >
        <View className="flex-row">
          <View className="w-16 h-16 bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl items-center justify-center mr-4">
            <Ionicons name="book" size={32} color="white" />
          </View>
          
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900">{item.name}</Text>
            <Text className="text-gray-500 text-sm mt-1">{item.description}</Text>
            
            <View className="flex-row items-center mt-2">
              <View className="flex-1 h-2 bg-gray-200 rounded-full mr-2">
                <View 
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </View>
              <Text className="text-sm text-gray-500">
                {item.learnedCount}/{item.wordCount}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Screen title="我的词汇书">
      <ScrollView className="flex-1 bg-gray-50">
        {/* 分类筛选 */}
        <View className="bg-white px-4 py-3 mb-2">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row">
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  className={`px-4 py-2 rounded-full mr-2 ${
                    selectedCategory === category.id 
                      ? 'bg-blue-500' 
                      : 'bg-gray-100'
                  }`}
                  onPress={() => setSelectedCategory(category.id)}
                >
                  <Text className={`font-medium ${
                    selectedCategory === category.id ? 'text-white' : 'text-gray-700'
                  }`}>
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* 词汇书列表 */}
        <View className="px-4 py-2">
          {loading ? (
            <View className="items-center py-20">
              <Text className="text-gray-500">加载中...</Text>
            </View>
          ) : filteredBooks.length === 0 ? (
            <View className="items-center py-20">
              <Ionicons name="book-outline" size={64} color="#d1d5db" />
              <Text className="text-gray-500 mt-4">暂无词汇书</Text>
              <TouchableOpacity className="mt-4 bg-blue-500 px-6 py-3 rounded-full">
                <Text className="text-white font-medium">去添加</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={filteredBooks}
              renderItem={renderBookItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
