import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { FontAwesome6 } from '@expo/vector-icons';
import { API_BASE_URL } from '@/utils/apiConfig';

interface WordItem {
  id: number;
  word: string;
  phonetic: string;
  meaning: string;
  status?: 'x1' | 'y1' | 'z1' | 'none';
}

export default function SubcategoryWordsPage() {
  const router = useSafeRouter();
  const { table, title } = useSafeSearchParams<{ table: string; title: string }>();
  const [words, setWords] = useState<WordItem[]>([]);
  const [loading, setLoading] = useState(true);

  const pageTitle = title || '单词列表';

  useEffect(() => {
    if (!table) return;

    /**
     * 服务端文件：server/src/routes/wordbooks.ts
     * 接口：GET /api/v1/wordbooks/:table
     * Path 参数：table: string
     */
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/v1/wordbooks/${table}`
        );
        const data = await response.json();
        if (!Array.isArray(data)) {
          setWords([]);
          return;
        }

        // For table 111, fetch x1/y1/z1 to mark classification status
        if (table === '111') {
          const [x1Res, y1Res, z1Res] = await Promise.all([
            fetch(`${API_BASE_URL}/api/v1/wordbooks/x1`),
            fetch(`${API_BASE_URL}/api/v1/wordbooks/y1`),
            fetch(`${API_BASE_URL}/api/v1/wordbooks/z1`),
          ]);
          const [x1Data, y1Data, z1Data] = await Promise.all([
            x1Res.json(),
            y1Res.json(),
            z1Res.json(),
          ]);

          const x1Words = new Set((Array.isArray(x1Data) ? x1Data : []).map((w: any) => w.word));
          const y1Words = new Set((Array.isArray(y1Data) ? y1Data : []).map((w: any) => w.word));
          const z1Words = new Set((Array.isArray(z1Data) ? z1Data : []).map((w: any) => w.word));

          const markedData = data.map((w: WordItem) => {
            if (x1Words.has(w.word)) return { ...w, status: 'x1' as const };
            if (y1Words.has(w.word)) return { ...w, status: 'y1' as const };
            if (z1Words.has(w.word)) return { ...w, status: 'z1' as const };
            return { ...w, status: 'none' as const };
          });
          setWords(markedData);
        } else {
          setWords(data);
        }
      } catch (error) {
        console.error('Error fetching words:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [table]);

  return (
    <Screen className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-3 pb-4 bg-white">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3"
          activeOpacity={0.7}
        >
          <FontAwesome6 name="arrow-left" size={18} color="#374151" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900">{pageTitle}</Text>
          <Text className="text-xs text-gray-500 mt-0.5">{words.length} 个单词</Text>
        </View>
      </View>

      {/* Enter Mindmap Study Button - only show when there are unclassified words */}
      {!loading && words.length > 0 && words.some((w) => w.status === 'none') && (
        <View className="px-4 pb-3 bg-white">
          <TouchableOpacity
            onPress={() => {
              // 找到第一个未分类的单词（status === 'none'）
              const firstUnclassified = words.find((w) => w.status === 'none');
              if (firstUnclassified) {
                router.push('/word-detail', {
                  word: JSON.stringify(firstUnclassified),
                  table,
                  from: 'mindmap',
                  index: words.indexOf(firstUnclassified).toString(),
                });
              }
            }}
            className="flex-row items-center justify-center py-3 rounded-xl"
            style={{ backgroundColor: '#4F46E5' }}
            activeOpacity={0.8}
          >
            <FontAwesome6 name="brain" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text className="text-white font-bold text-base">看词分类</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Show "all classified" hint when no unclassified words */}
      {!loading && words.length > 0 && !words.some((w) => w.status === 'none') && (
        <View className="px-4 pb-3 bg-white">
          <View
            className="flex-row items-center justify-center py-3 rounded-xl"
            style={{ backgroundColor: '#ECFDF5' }}
          >
            <FontAwesome6 name="circle-check" size={18} color='#059669' style={{ marginRight: 8 }} />
            <Text className="font-bold text-base" style={{ color: '#059669' }}>
              全部已分类
            </Text>
          </View>
        </View>
      )}

      {/* Word Grid - all on one page, no scroll indicator */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text className="text-gray-500 mt-3">加载中...</Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 12 }}
        >
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            {words.map((item, index) => {
              const getButtonColor = () => {
                switch (item.status) {
                  case 'x1': return '#22c55e';
                  case 'y1': return '#f97316';
                  case 'z1': return '#ef4444';
                  default: return '#9ca3af';
                }
              };
              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.7}
                  onPress={() => router.push('/word-detail', { word: JSON.stringify(item), table, from: 'mindmap', index: index.toString() })}
                  style={{
                    width: '31%',
                    backgroundColor: getButtonColor(),
                    borderRadius: 12,
                    paddingVertical: 10,
                    paddingHorizontal: 4,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 1,
                    marginBottom: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: '#fff',
                      textAlign: 'center',
                    }}
                    numberOfLines={1}
                  >
                    {item.word}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}
