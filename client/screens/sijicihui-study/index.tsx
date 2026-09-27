import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, PanResponder, Modal, ActivityIndicator, ScrollView } from 'react-native';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { useFocusEffect } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { fetchWithRetry } from '@/utils/apiClient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Word {
  id: number;
  word: string;
  phonetic?: string;
  meaning: string;
  example?: string;
  example_translation?: string;
}

interface Stats {
  total: number;
  learned: number;
  pending: number;
  known: number;
  vague: number;
  unknown: number;
}

const CATEGORY_META = [
  { key: 'known', label: '已会', color: '#4CAF50' },
  { key: 'vague', label: '模糊', color: '#FF9800' },
  { key: 'unknown', label: '不会', color: '#F44336' },
];

interface DraggableWordCardProps {
  word: Word;
  onDrop: (wordId: number, categoryId: number) => void;
  onPress: () => void;
}

function DraggableWordCard({ word, onDrop, onPress }: DraggableWordCardProps) {
  const pan = useRef(new Animated.ValueXY()).current;
  const [isDragging, setIsDragging] = useState(false);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          setIsDragging(true);
          pan.setOffset({
            x: (pan.x as any)._value || 0,
            y: (pan.y as any)._value || 0,
          });
          pan.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: (_evt, gestureState) => {
          pan.setValue({ x: gestureState.dx, y: gestureState.dy });
        },
        onPanResponderRelease: (_evt, gestureState) => {
          setIsDragging(false);
          pan.flattenOffset();
          const dy = gestureState.dy;
          const absoluteX = gestureState.moveX;
          if (dy > 80) {
            let targetCategory = 3;
            if (absoluteX < SCREEN_WIDTH / 3) {
              targetCategory = 1;
            } else if (absoluteX < (SCREEN_WIDTH / 3) * 2) {
              targetCategory = 2;
            }
            onDrop(word.id, targetCategory);
          }
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        },
        onPanResponderTerminate: () => {
          setIsDragging(false);
          pan.flattenOffset();
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        },
      }),
    [onDrop, word.id, pan]
  );

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.wordItemContainer,
        {
          transform: [{ translateX: pan.x }, { translateY: pan.y }],
          opacity: isDragging ? 0.8 : 1,
          zIndex: isDragging ? 100 : 1,
        },
      ]}
    >
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <View style={styles.wordCard}>
          <Text style={styles.wordCardText}>{word.word}</Text>
          {word.meaning ? (
            <Text style={styles.cardMeaning} numberOfLines={2}>
              {word.meaning}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function SijicihuiStudyPage() {
  const router = useSafeRouter();
  const [allWords, setAllWords] = useState<Word[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pageRef = useRef(1);
  const loadedCountRef = useRef(0);

  // 分类复习列表弹窗
  const [catModal, setCatModal] = useState<{ status: string; label: string; list: Word[]; loading: boolean } | null>(null);
  // 单词详情弹窗
  const [detailWord, setDetailWord] = useState<Word | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetchWithRetry('/api/v1/sijicihui-study/progress');
      const json = await res.json();
      if (json.success) setStats(json.data);
    } catch (e) {
      console.error('加载四级进度失败', e);
    }
  }, []);

  const loadWords = useCallback(async (reset = false) => {
    const PAGE_SIZE = 100;
    if (reset) {
      pageRef.current = 1;
      loadedCountRef.current = 0;
      setAllWords([]);
    }
    const page = pageRef.current;
    try {
      const res = await fetchWithRetry(`/api/v1/sijicihui-study/words?status=&page=${page}&limit=${PAGE_SIZE}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const words: Word[] = json.data;
        loadedCountRef.current += words.length;
        setAllWords((prev) => (reset ? words : [...prev, ...words]));
        // 本页不足一页 = 已全部取完
        pageRef.current = words.length < PAGE_SIZE ? -1 : page + 1;
      }
    } catch (e) {
      console.error('加载四级待学词失败', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setError(null);
      Promise.all([loadStats(), loadWords(true)]);
    }, [loadStats, loadWords])
  );

  const displayWords = allWords.slice(0, 3);
  const remainingCount = stats ? stats.pending : allWords.length;

  const handleDrop = useCallback(
    async (wordId: number, categoryId: number) => {
      const status = CATEGORY_META[categoryId - 1].key;
      try {
        const res = await fetchWithRetry('/api/v1/sijicihui-study/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wordId, status }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message || '上报失败');
      } catch (e) {
        console.error('上报四级记忆状态失败', e);
        return; // 失败不移除
      }

      const remaining = allWords.filter((w) => w.id !== wordId);
      setAllWords(remaining);
      // 剩余词不足 3 张且还有下一页时补拉
      if (remaining.length <= 3 && pageRef.current !== -1) {
        const PAGE_SIZE = 100;
        const res = await fetchWithRetry(`/api/v1/sijicihui-study/words?status=&page=${pageRef.current}&limit=${PAGE_SIZE}`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          loadedCountRef.current += json.data.length;
          setAllWords((prev) => [...prev, ...json.data]);
          pageRef.current = json.data.length < PAGE_SIZE ? -1 : (pageRef.current || 1) + 1;
        }
      }
      loadStats();
    },
    [allWords, loadStats]
  );

  const openCategory = useCallback(async (idx: number) => {
    const meta = CATEGORY_META[idx];
    setCatModal({ status: meta.key, label: meta.label, list: [], loading: true });
    try {
      const res = await fetchWithRetry(`/api/v1/sijicihui-study/words?status=${meta.key}&limit=200`);
      const json = await res.json();
      if (json.success) {
        setCatModal({ status: meta.key, label: meta.label, list: json.data || [], loading: false });
      } else {
        setCatModal({ status: meta.key, label: meta.label, list: [], loading: false });
      }
    } catch (e) {
      setCatModal({ status: meta.key, label: meta.label, list: [], loading: false });
      console.error('加载分类列表失败', e);
    }
  }, []);

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>back</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>四级词汇</Text>
            <Text style={styles.irisEnableText}>四级 CET4 · 记忆</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/calendar')}>
            <FontAwesome6 name="calendar-days" size={22} color="#333333" />
          </TouchableOpacity>
        </View>

        <View style={styles.centerContainer}>
          <View style={styles.content}>
            {error ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.errorText}>加载失败: {error}</Text>
              </View>
            ) : (
              <>
                <Text style={styles.remainingText}>剩余 {remainingCount} 个单词</Text>
                {displayWords.length > 0 ? (
                  <View style={styles.wordRow}>
                    {displayWords.map((word) => (
                      <DraggableWordCard
                        key={word.id}
                        word={word}
                        onDrop={handleDrop}
                        onPress={() => setDetailWord(word)}
                      />
                    ))}
                  </View>
                ) : !stats ? (
                  <View style={styles.emptyContainer}>
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text style={styles.emptyText}>加载中...</Text>
                  </View>
                ) : (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>所有单词已分类完成！</Text>
                  </View>
                )}
              </>
            )}
          </View>

          <View style={styles.categorySection}>
            <View style={styles.categoryRow}>
              {CATEGORY_META.map((meta, idx) => (
                <TouchableOpacity key={meta.key} style={styles.categoryItem} onPress={() => openCategory(idx)}>
                  <View style={[styles.categoryCard, { backgroundColor: meta.color }]}>
                    <Text style={styles.categoryName}>{meta.label}</Text>
                    <Text style={styles.categoryCount}>
                      ({stats ? stats[meta.key as keyof Stats] : 0})
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.instructionText}>拖动单词到下方分类区域</Text>
          </View>
        </View>

        {/* 分类复习列表 */}
        <Modal visible={!!catModal} transparent animationType="slide" onRequestClose={() => setCatModal(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{catModal?.label} · 四级词汇</Text>
                <TouchableOpacity onPress={() => setCatModal(null)}>
                  <Text style={styles.modalClose}>关闭</Text>
                </TouchableOpacity>
              </View>
              {catModal?.loading ? (
                <View style={styles.emptyContainer}>
                  <ActivityIndicator size="large" color="#4CAF50" />
                </View>
              ) : (
                <ScrollView>
                  {catModal && catModal.list.length > 0 ? (
                    catModal.list.map((w) => (
                      <View key={w.id} style={styles.reviewItem}>
                        <Text style={styles.reviewWord}>{w.word}</Text>
                        <Text style={styles.reviewMeaning}>{w.meaning}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.reviewEmpty}>该分类暂无词汇</Text>
                  )}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        {/* 单词详情 */}
        <Modal visible={!!detailWord} transparent animationType="fade" onRequestClose={() => setDetailWord(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.detailBox}>
              {detailWord ? (
                <>
                  <Text style={styles.detailWord}>{detailWord.word}</Text>
                  {detailWord.phonetic ? <Text style={styles.detailPhonetic}>{detailWord.phonetic}</Text> : null}
                  <Text style={styles.detailMeaning}>{detailWord.meaning}</Text>
                </>
              ) : null}
              <TouchableOpacity style={styles.detailClose} onPress={() => setDetailWord(null)}>
                <Text style={styles.detailCloseText}>返回</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#E5E5E5',
  },
  headerCenter: { alignItems: 'center' },
  backText: { fontSize: 14, color: '#000000' },
  title: { fontSize: 16, color: '#333333', fontWeight: '600' },
  irisEnableText: { fontSize: 10, color: '#4CAF50', marginTop: 4 },
  centerContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  content: { paddingVertical: 16, alignItems: 'center', transform: [{ translateY: -100 }] },
  remainingText: { fontSize: 14, color: '#999999', marginBottom: 20 },
  wordRow: { flexDirection: 'row', gap: 28, justifyContent: 'center' },
  wordItemContainer: { width: 90 },
  wordCard: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 70,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  wordCardText: { fontSize: 12, color: '#333333', fontWeight: '600' },
  cardMeaning: { fontSize: 9, color: '#888888', textAlign: 'center', marginTop: 4, lineHeight: 12 },
  categorySection: { paddingVertical: 10, backgroundColor: '#FFFFFF' },
  categoryRow: { flexDirection: 'row', gap: 10 },
  categoryItem: { flex: 1 },
  categoryCard: { paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  categoryName: { fontSize: 13, color: '#FFFFFF', fontWeight: '600' },
  categoryCount: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  instructionText: { fontSize: 11, color: '#999999', textAlign: 'center', marginTop: 6 },
  emptyContainer: { padding: 48, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#999999' },
  errorText: { fontSize: 14, color: '#E53935', marginBottom: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    maxHeight: '70%',
    padding: 16,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 16, color: '#333333', fontWeight: '600' },
  modalClose: { fontSize: 14, color: '#4CAF50' },
  reviewItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  reviewWord: { fontSize: 15, color: '#333333', fontWeight: '600', flexShrink: 1, paddingRight: 8 },
  reviewMeaning: { fontSize: 13, color: '#666666', flexShrink: 1, textAlign: 'right' },
  reviewEmpty: { fontSize: 14, color: '#999999', textAlign: 'center', padding: 24 },
  detailBox: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, alignItems: 'center' },
  detailWord: { fontSize: 28, color: '#333333', fontWeight: '700' },
  detailPhonetic: { fontSize: 16, color: '#888888', marginTop: 6 },
  detailMeaning: { fontSize: 16, color: '#555555', marginTop: 12, textAlign: 'center' },
  detailClose: { marginTop: 20, backgroundColor: '#4CAF50', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  detailCloseText: { color: '#FFFFFF', fontWeight: '600' },
});