/* eslint-disable react-hooks/refs */
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, PanResponder } from 'react-native';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { useFocusEffect, useRouter } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { fetchWithRetry } from '@/utils/apiClient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PAGE_SIZE = 50;

interface Word {
	id: number;
	word: string;
	phonetic?: string;
	meaning: string;
}

interface DraggableWordCardProps {
	word: Word;
	onDrop: (wordId: number, categoryId: number) => void;
	onPress: () => void;
}

// 复刻 learn 的拖动单词小卡：只显示单词，垂直拖到下方三分类
function DraggableWordCard({ word, onDrop, onPress }: DraggableWordCardProps) {
	const pan = useRef(new Animated.ValueXY()).current;
	const [isDragging, setIsDragging] = useState(false);

	const closePan = useCallback(() => {
		Animated.spring(pan, {
			toValue: { x: 0, y: 0 },
			useNativeDriver: false,
			friction: 5,
		}).start();
	}, [pan]);

	const panResponder = useMemo(
		() =>
			PanResponder.create({
				onStartShouldSetPanResponder: () => true,
				onMoveShouldSetPanResponder: () => true,
				onPanResponderGrant: () => {
					setIsDragging(true);
					pan.setOffset({ x: (pan.x as any)._value || 0, y: (pan.y as any)._value || 0 });
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
						if (absoluteX < SCREEN_WIDTH / 3) targetCategory = 1;
						else if (absoluteX < (SCREEN_WIDTH / 3) * 2) targetCategory = 2;
						onDrop(word.id, targetCategory);
						return;
					}
					closePan();
				},
				onPanResponderTerminate: () => {
					setIsDragging(false);
					pan.flattenOffset();
					closePan();
				},
			}),
		[onDrop, word.id, pan, closePan]
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
					<Text style={styles.wordCardText} numberOfLines={2}>{word.word}</Text>
				</View>
			</TouchableOpacity>
		</Animated.View>
	);
}

const CATEGORY_CONFIG = {
	1: { label: '已会', status: 'known' as const, color: '#4CAF50', route: '/sijicihui-known-words' as const },
	2: { label: '模糊', status: 'vague' as const, color: '#FF9800', route: '/sijicihui-vague-words' as const },
	3: { label: '不会', status: 'unknown' as const, color: '#F44336', route: '/sijicihui-unknown-words' as const },
};

export default function SijicihuiStudyPage() {
	const router = useSafeRouter();
	const nativeRouter = useRouter();
	const [words, setWords] = useState<Word[]>([]);
	const [pendingCount, setPendingCount] = useState(0);
	const [categoryCounts, setCategoryCounts] = useState({ 1: 0, 2: 0, 3: 0 });
	const [isLoading, setIsLoading] = useState(true);
	const [hasMore, setHasMore] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const pageRef = useRef(1);
	const loadingRef = useRef(false);

	const fetchPage = useCallback(async (page: number, append: boolean) => {
		if (loadingRef.current) return;
		loadingRef.current = true;
		try {
			setIsLoading(!append);
			const response = await fetchWithRetry(
				`/api/v1/sijicihui-study/words?status=&page=${page}&limit=${PAGE_SIZE}`
			);
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			const json = await response.json();
			const list: Word[] = (json.data || []).map((w: any) => ({
				id: w.id,
				word: w.word,
				phonetic: w.phonetic,
				meaning: w.meaning,
			}));
			pageRef.current = page;
			setHasMore(list.length === PAGE_SIZE);
			setWords(prev => (append ? [...prev, ...list] : list));
		} catch (e: any) {
			console.error('[SijicihuiStudy] fetch words failed:', e);
			setError(e.message || '获取单词列表失败');
		} finally {
			setIsLoading(false);
			loadingRef.current = false;
		}
	}, []);

	const fetchProgress = useCallback(async () => {
		try {
			const response = await fetchWithRetry(`/api/v1/sijicihui-study/progress`);
			if (!response.ok) return;
			const json = await response.json();
			const d = json.data || {};
			setCategoryCounts({ 1: d.known || 0, 2: d.vague || 0, 3: d.unknown || 0 });
			setPendingCount(typeof d.pending === 'number' ? d.pending : 0);
		} catch (e) {
			console.error('[SijicihuiStudy] fetch progress failed:', e);
		}
	}, []);

	useEffect(() => {
		const timer = setTimeout(() => {
			fetchPage(1, false);
			fetchProgress();
		}, 0);
		return () => clearTimeout(timer);
	}, [fetchPage, fetchProgress]);

	useFocusEffect(
		useCallback(() => {
			fetchProgress();
		}, [fetchProgress])
	);

	// 拖动分类：上报记忆状态 + 从队列移除 + 刷新计数
	const handleDrop = useCallback(
		async (wordId: number, categoryId: number) => {
			const cfg = (CATEGORY_CONFIG as Record<number, { label: string; status: 'known' | 'vague' | 'unknown'; color: string; route: string }>)[categoryId];
			if (!cfg) return;
			try {
				const response = await fetchWithRetry(`/api/v1/sijicihui-study/status`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ wordId, status: cfg.status }),
				});
				if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			} catch (e) {
				console.error('Failed to set word status:', e);
				return;
			}
			setWords(prev => prev.filter(w => w.id !== wordId));
			fetchProgress();
		},
		[fetchProgress]
	);

	const handleWordPress = useCallback(
		(word: Word) => {
			nativeRouter.push({
				pathname: '/sijicihui-word-detail',
				params: { word: JSON.stringify({ id: word.id, word: word.word, phonetic: word.phonetic || '', meaning: word.meaning }) },
			});
		},
		[nativeRouter]
	);

	const loadMore = useCallback(() => {
		if (hasMore && words.length < 5 && !loadingRef.current) {
			fetchPage(pageRef.current + 1, true);
		}
	}, [hasMore, words.length, fetchPage]);

	const displayWords = words.slice(0, 3);
	const goBack = useCallback(() => {
		if (router.canGoBack && router.canGoBack()) router.back();
		else router.replace('/');
	}, [router]);

	return (
		<Screen>
			<View style={styles.container}>
				{/* Header */}
				<View style={styles.header}>
					<TouchableOpacity onPress={goBack} style={styles.backButton} activeOpacity={0.6}>
						<Text style={styles.backText}>back</Text>
					</TouchableOpacity>
					<View style={styles.headerCenter}>
						<Text style={styles.title}>四级词汇</Text>
						<Text style={styles.headerCount}>{isLoading ? '加载中...' : `${pendingCount} 个单词待学习`}</Text>
					</View>
					<TouchableOpacity onPress={() => nativeRouter.push('/calendar' as any)} style={styles.calButton} activeOpacity={0.6}>
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
								<Text style={styles.remainingText}>剩余 {pendingCount} 个单词</Text>
								{displayWords.length > 0 ? (
									<View style={styles.wordRow}>
										{displayWords.map((word) => (
											<DraggableWordCard
												key={word.id}
												word={word}
												onDrop={handleDrop}
												onPress={() => handleWordPress(word)}
											/>
										))}
									</View>
								) : (
									<View style={styles.emptyContainer}>
										{isLoading ? (
											<Text style={styles.emptyText}>加载中...</Text>
										) : (
											<Text style={styles.emptyText}>所有单词已分类完成！</Text>
										)}
									</View>
								)}
								{!error && displayWords.length === 0 && hasMore && (
									<TouchableOpacity onPress={loadMore} style={styles.loadMoreBtn}>
										<Text style={styles.loadMoreText}>加载更多</Text>
									</TouchableOpacity>
								)}
							</>
						)}
					</View>
				</View>

				{/* Action Buttons */}
				<View style={styles.actionSection}>
					<Text style={styles.actionHint}>拖动单词到下方分类区域</Text>
					<View style={styles.actionRow}>
						{([1, 2, 3] as (keyof typeof CATEGORY_CONFIG)[]).map((key) => {
							const cfg = CATEGORY_CONFIG[key];
							return (
								<TouchableOpacity
									key={key}
									style={[styles.actionButton, { backgroundColor: cfg.color }]}
									activeOpacity={0.8}
									onPress={() => router.push(cfg.route)}
								>
									<Text style={styles.actionButtonText}>{cfg.label}</Text>
									<Text style={styles.actionButtonCount}>({categoryCounts[key]})</Text>
								</TouchableOpacity>
							);
						})}
					</View>
				</View>
			</View>
		</Screen>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: '#FFFFFF' },
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		paddingTop: 10,
		paddingBottom: 10,
		borderBottomWidth: 1,
		borderBottomColor: '#F3F4F6',
	},
	backButton: { paddingRight: 8, minWidth: 60 },
	backText: { fontSize: 16, color: '#1F2937' },
	headerCenter: { alignItems: 'center', flex: 1 },
	title: { fontSize: 18, fontWeight: '700', color: '#111827' },
	headerCount: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
	calButton: { paddingLeft: 8, minWidth: 40, alignItems: 'flex-end' },
	centerContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 24 },
	content: { flex: 1 },
	remainingText: { textAlign: 'center', fontSize: 14, color: '#9CA3AF', marginBottom: 20 },
	wordRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
	wordItemContainer: { width: (SCREEN_WIDTH - 32 - 24) / 3 },
	wordCard: {
		borderRadius: 16,
		backgroundColor: '#F3F4F6',
		paddingVertical: 48,
		paddingHorizontal: 8,
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: 140,
	},
	wordCardText: { fontSize: 18, fontWeight: '600', color: '#1F2937', textAlign: 'center' },
	emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
	emptyText: { fontSize: 15, color: '#9CA3AF', marginTop: 20 },
	errorText: { fontSize: 15, color: '#EF4444', marginTop: 20, textAlign: 'center' },
	loadMoreBtn: { alignSelf: 'center', marginTop: 24, paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, backgroundColor: '#EEF2FF' },
	loadMoreText: { color: '#4F46E5', fontSize: 14, fontWeight: '600' },
	actionSection: { paddingHorizontal: 16, paddingBottom: 20, paddingTop: 8 },
	actionHint: { textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginBottom: 12 },
	actionRow: { flexDirection: 'row', gap: 12 },
	actionButton: {
		flex: 1,
		borderRadius: 16,
		paddingVertical: 16,
		alignItems: 'center',
	},
	actionButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
	actionButtonCount: { color: '#FFFFFF', fontSize: 12, marginTop: 2, opacity: 0.9 },
});