import { View, Text, ScrollView, TouchableOpacity, FlatList, Alert } from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { getApiBaseUrl } from '@/utils/apiConfig';
import { useAuth } from '@/contexts/AuthContext';

interface Word {
  id: string;
  word: string;
  phonetic: string;
  meaning: string;
  addedAt: string;
}

export default function WordBookScreen() {
  const router = useSafeRouter();
  const { user } = useAuth();
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWords();
  }, []);

  const loadWords = async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/word-book`, {
        headers: {
          'Authorization': `Bearer ${user?.token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setWords(data.data || []);
      }
    } catch (error) {
      console.error('加载生词本失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveWord = (wordId: string) => {
    Alert.alert(
      '移除单词',
      '确定要将这个单词从生词本中移除吗？',
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '确定移除',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${getApiBaseUrl()}/api/v1/word-book/${wordId}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${user?.token}`,
                },
              });
              if (response.ok) {
                setWords(words.filter(w => w.id !== wordId));
                Alert.alert('成功', '单词已移除');
              }
            } catch (error) {
              Alert.alert('错误', '移除失败，请稍后重试');
            }
          }
        },
      ]
    );
  };

  const handleReviewWords = () => {
    if (words.length === 0) {
      Alert.alert('提示', '生词本为空');
      return;
    }
    router.push({ pathname: '/review', params: { words: JSON.stringify(words) } });
  };

  const renderWordItem = ({ item }: { item: Word }) => (
    <View className="bg-white rounded-xl p-4 mb-2 shadow-sm">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900">{item.word}</Text>
          <Text className="text-gray-500 text-sm mt-1">{item.phonetic}</Text>
          <Text className="text-gray-700 mt-2">{item.meaning}</Text>
          <Text className="text-gray-400 text-xs mt-2">
            添加于 {new Date(item.addedAt).toLocaleDateString('zh-CN')}
          </Text>
        </View>
        <TouchableOpacity 
          className="p-2"
          onPress={() => handleRemoveWord(item.id)}
        >
          <Ionicons name="trash-outline" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Screen title="生词本">
      <View className="flex-1 bg-gray-50">
        {/* 统计信息 */}
        <View className="bg-white px-4 py-3 mb-2 flex-row items-center justify-between">
          <Text className="text-gray-700">
            共 <Text className="text-blue-600 font-bold">{words.length}</Text> 个单词
          </Text>
          <TouchableOpacity 
            className="bg-blue-500 px-4 py-2 rounded-full flex-row items-center"
            onPress={handleReviewWords}
          >
            <Ionicons name="refresh" size={18} color="white" />
            <Text className="text-white font-medium ml-1">复习</Text>
          </TouchableOpacity>
        </View>

        {/* 单词列表 */}
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-gray-500">加载中...</Text>
          </View>
        ) : words.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Ionicons name="book-outline" size={64} color="#d1d5db" />
            <Text className="text-gray-500 mt-4">生词本为空</Text>
            <Text className="text-gray-400 text-sm mt-2">学习时遇到的生词会自动添加到这里</Text>
          </View>
        ) : (
          <FlatList
            data={words}
            renderItem={renderWordItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16 }}
          />
        )}
      </View>
    </Screen>
  );
}
