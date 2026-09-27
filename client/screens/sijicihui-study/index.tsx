import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { fetchWithRetry } from '@/utils/apiClient';

interface StudyWord {
  id: number;
  word: string;
  phonetic: string | null;
  meaning: string | null;
  status: string;
}
interface Stats {
  total: number;
  learned: number;
  pending: number;
  known: number;
  vague: number;
  unknown: number;
}

type TabKey = 'learning' | 'known' | 'vague' | 'unknown';

const STATUS_META: Record<Exclude<TabKey, 'learning'>, { label: string; color: string }> = {
  known: { label: '认识', color: '#4CAF50' },
  vague: { label: '模糊', color: '#FF9800' },
  unknown: { label: '不认识', color: '#F44336' },
};

export default function SijicihuiStudy() {
  const router = useSafeRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [queue, setQueue] = useState<StudyWord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<TabKey>('learning');
  const [reviewList, setReviewList] = useState<StudyWord[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const pageRef = useRef(1);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetchWithRetry('/api/v1/sijicihui-study/progress');
      const json = await res.json();
      if (json.success) setStats(json.data);
    } catch (e) {
      console.error('加载四级进度失败', e);
    }
  }, []);

  const loadQueue = useCallback(async (reset = false) => {
    if (reset) {
      pageRef.current = 1;
      setQueue([]);
    }
    const page = pageRef.current;
    try {
      const res = await fetchWithRetry(`/api/v1/sijicihui-study/words?status=&page=${page}&limit=15`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const words: StudyWord[] = json.data;
        setQueue((prev) => (reset ? words : [...prev, ...words]));
        pageRef.current = page + 1;
      }
    } catch (e) {
      console.error('加载四级待学词失败', e);
    }
  }, []);

  const loadReview = useCallback(async (status: string) => {
    setReviewLoading(true);
    try {
      const res = await fetchWithRetry(`/api/v1/sijicihui-study/words?status=${status}&limit=200`);
      const json = await res.json();
      if (json.success) setReviewList(json.data || []);
    } catch (e) {
      console.error('加载复习词失败', e);
    } finally {
      setReviewLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setIsLoading(true);
      (async () => {
        await Promise.all([loadStats(), loadQueue(true)]);
        if (active) setIsLoading(false);
      })();
      return () => {
        active = false;
      };
    }, [loadStats, loadQueue])
  );

  const switchTab = async (t: TabKey) => {
    setTab(t);
    if (t !== 'learning') {
      await loadReview(t);
    }
  };

  const current = queue[0];

  const mark = async (status: string) => {
    if (!current || saving) return;
    setSaving(true);
    try {
      await fetchWithRetry('/api/v1/sijicihui-study/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordId: current.id, status }),
      });
      if (queue.length === 1) {
        await loadQueue(false);
      } else {
        setQueue((prev) => prev.slice(1));
      }
      await loadStats();
    } catch (e) {
      console.error('上报记忆状态失败', e);
    } finally {
      setSaving(false);
    }
  };

  const pendingPreview = stats ? Math.min(stats.pending, queue.length) : queue.length;

  return (
    <Screen>
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-sm text-gray-600">← back</Text>
          </TouchableOpacity>
          <Text className="text-base font-bold text-gray-800">四级词汇 · 记忆</Text>
          <View className="w-14" />
        </View>

        {/* 进度 */}
        {stats ? (
          <View className="px-4 pt-3">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-sm text-gray-600">待学 {stats.pending} · 已学 {stats.learned} / 共 {stats.total}</Text>
              <Text className="text-xs text-gray-400">剩余本批 {pendingPreview}</Text>
            </View>
            <View className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <View
                className="h-2 rounded-full"
                style={{
                  width: `${stats.total > 0 ? Math.round((stats.learned / stats.total) * 100) : 0}%`,
                  backgroundColor: '#4CAF50',
                }}
              />
            </View>
          </View>
        ) : (
          <View className="px-4 pt-3">
            <View className="h-2 rounded-full bg-gray-200" />
          </View>
        )}

        {/* 统计胶囊（点击进入对应分类复习） */}
        <View className="flex-row justify-around px-4 py-2">
          {(['known', 'vague', 'unknown'] as const).map((k) => {
            const meta = STATUS_META[k];
            const count = stats ? stats[k] : 0;
            const active = tab === k;
            return (
              <TouchableOpacity
                key={k}
                onPress={() => switchTab(k)}
                className="flex-row items-center rounded-full px-3 py-1.5 border"
                style={{
                  backgroundColor: active ? meta.color : '#FFFFFF',
                  borderColor: meta.color,
                }}
              >
                <Text className="text-xs" style={{ color: active ? '#FFFFFF' : meta.color }}>
                  {meta.label} {count}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 主区域 */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text className="mt-2 text-sm text-gray-500">加载中...</Text>
          </View>
        ) : tab === 'learning' ? (
          current ? (
            // 词卡
            <View className="flex-1 px-4 pb-4">
              <View className="flex-1 rounded-2xl border border-gray-200 bg-gray-50 items-center justify-center px-6">
                <Text className="text-3xl font-bold text-gray-900 text-center">{current.word}</Text>
                {current.phonetic ? <Text className="mt-2 text-base text-gray-500">{current.phonetic}</Text> : null}
                <View className="h-px w-16 bg-gray-300 my-4" />
                <Text className="text-lg text-gray-700 text-center">{current.meaning}</Text>
              </View>
              <View className="flex-row justify-between mt-4">
                {(['known', 'vague', 'unknown'] as const).map((k) => (
                  <TouchableOpacity
                    key={k}
                    disabled={saving}
                    onPress={() => mark(k)}
                    className="flex-1 mx-1 py-3 rounded-xl"
                    style={{ backgroundColor: STATUS_META[k].color }}
                  >
                    <Text className="text-center text-white font-semibold">{STATUS_META[k].label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            // 待学清空
            <View className="flex-1 items-center justify-center px-6">
              <Text className="text-lg font-semibold text-gray-800">本批待学词已学完</Text>
              <Text className="mt-2 text-sm text-gray-500">点击右上角记忆分类按钮查看已标记词汇，或返回稍后再学。</Text>
              <TouchableOpacity
                onPress={() => loadQueue(true)}
                className="mt-5 px-6 py-3 rounded-xl"
                style={{ backgroundColor: '#4CAF50' }}
              >
                <Text className="text-white font-semibold">刷新待学词</Text>
              </TouchableOpacity>
            </View>
          )
        ) : (
          // 分类复习列表
          <View className="flex-1">
            {reviewLoading ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color="#4CAF50" />
              </View>
            ) : (
              <FlatList
                data={reviewList}
                keyExtractor={(item) => String(item.id)}
                contentContainerClassName="px-4 pt-1 pb-6"
                ListEmptyComponent={
                  <View className="items-center py-10">
                    <Text className="text-sm text-gray-500">该分类暂无词汇</Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <View className="flex-row items-start justify-between border-b border-gray-100 py-3">
                    <View className="flex-1 pr-3">
                      <Text className="text-base font-semibold text-gray-900">{item.word}</Text>
                      <Text className="text-sm text-gray-600 mt-0.5">{item.meaning}</Text>
                    </View>
                    <Text className="text-xs" style={{ color: STATUS_META[tab].color }}>
                      {STATUS_META[tab].label}
                    </Text>
                  </View>
                )}
              />
            )}
          </View>
        )}
      </View>
    </Screen>
  );
}