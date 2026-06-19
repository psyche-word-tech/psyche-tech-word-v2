import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, Modal, Image } from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { FontAwesome6 } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '@/utils/apiConfig';
import { Base64 } from 'js-base64';

interface WordItem {
  id: number;
  word: string;
  phonetic: string;
  meaning: string;
  noun_phrase?: string;
  phrase_translation?: string;
  phrase_phonetic?: string;
  phrase_image_url?: string;
  status?: 'm1' | 'm2' | 'm3' | 'none';
}

export default function SubcategoryWordsPage() {
  const router = useSafeRouter();
  const { table, title } = useSafeSearchParams<{ table: string; title: string }>();
  const [words, setWords] = useState<WordItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 看词分类弹窗状态
  const [unclassifiedModalVisible, setUnclassifiedModalVisible] = useState(false);
  const [currentUnclassifiedIndex, setCurrentUnclassifiedIndex] = useState(0);

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

        // For table 111, fetch m1/m2/m3 to mark classification status
        if (table === '111') {
          const [m1Res, m2Res, m3Res] = await Promise.all([
            fetch(`${API_BASE_URL}/api/v1/wordbooks/m1`),
            fetch(`${API_BASE_URL}/api/v1/wordbooks/m2`),
            fetch(`${API_BASE_URL}/api/v1/wordbooks/m3`),
          ]);
          const [m1Data, m2Data, m3Data] = await Promise.all([
            m1Res.json(),
            m2Res.json(),
            m3Res.json(),
          ]);

          const m1Words = new Set((Array.isArray(m1Data) ? m1Data : []).map((w: any) => w.word));
          const m2Words = new Set((Array.isArray(m2Data) ? m2Data : []).map((w: any) => w.word));
          const m3Words = new Set((Array.isArray(m3Data) ? m3Data : []).map((w: any) => w.word));

          const markedData = data.map((w: WordItem) => {
            if (m1Words.has(w.word)) return { ...w, status: 'm1' as const };
            if (m2Words.has(w.word)) return { ...w, status: 'm2' as const };
            if (m3Words.has(w.word)) return { ...w, status: 'm3' as const };
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
              const unclassified = words.filter((w) => w.status === 'none');
              if (unclassified.length > 0) {
                router.push('/word-detail', {
                  table,
                  from: 'mindmap',
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
                  case 'm1': return '#22c55e';
                  case 'm2': return '#f97316';
                  case 'm3': return '#ef4444';
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
