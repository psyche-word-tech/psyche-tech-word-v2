import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
	View,
	Text,
	StyleSheet,
	Dimensions,
	FlatList,
	TouchableOpacity,
	Animated,
	PanResponder,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { fetchWithRetry } from '@/utils/apiClient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;
const PAGE_SIZE = 50;

interface Word {
	id: number;
	word: string;
	meaning: string;
	phonetic: string;
}

const CATEGORY_CONFIG = {
	x: { label: '已会', status: 'known' as const, color: '#4CAF50', route: '/sijicihui-known-words' as const },
	y: { label: '模糊', status: 'vague' as const, color: '#FF9800', route: '/sijicihui-vague-words' as const },
	z: { label: '不会', status: 'unknown' as const, color: '#F44336', route: '/sijicihui-unknown-words' as const },
};

export default function SijicihuiStudyPage() {
	const router = useSafeRouter();
	const [words, setWords] = useState<Word[]>([]);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [categoryCounts, setCategoryCounts] = useState({ x: 0, y: 0, z: 0 });
	const [pendingCount, setPendingCount] = useState(0);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [hasMore, setHasMore] = useState(false);
	const pageRef = useRef(1);
	const loadingRef = useRef(false);

	const pan = useRef(new Animated.ValueXY()).current;
	const [isDragging, setIsDragging] = useState(false);
	const [dropTarget, setDropTarget] = useState<string | null>(null);
	const dragJustEnded = useRef(false);

	const buttonRefs = useRef<{ [key: string]: View | null }>({}).current;
	const [buttonLayouts, setButtonLayouts] = useState<{
		[key: string]: { x: number; y: number; width: number; height: number };
	}>({});

	// 获取四级待分类单词（分页）
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
			if (!append) setCurrentIndex(0);
		} catch (e: any) {
			console.error('[SijicihuiStudy] fetch words failed:', e);
			setError(e.message || '获取单词列表失败');
		} finally {
			setIsLoading(false);
			loadingRef.current = false;
		}
	}, []);

	const loadMore = useCallback(() => {
		if (hasMore && !loadingRef.current) {
			fetchPage(pageRef.current + 1, true);
		}
	}, [hasMore, fetchPage]);

	// 获取分类计数 + 待分类数量
	const fetchProgress = useCallback(async () => {
		try {
			const response = await fetchWithRetry(`/api/v1/sijicihui-study/progress`);
			if (!response.ok) return;
			const json = await response.json();
			const d = json.data || {};
			setCategoryCounts({
				x: d.known || 0,
				y: d.vague || 0,
				z: d.unknown || 0,
			});
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

	// 移动单词到分类（按用户隔离的记忆状态）
	const handleMoveWord = useCallback(async (word: Word, status: string) => {
		try {
			const response = await fetchWithRetry(`/api/v1/sijicihui-study/status`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ wordId: word.id, status }),
			});
			if (!response.ok) throw new Error('移动失败');
			const newWords = words.filter(w => w.id !== word.id);
			setWords(newWords);
			if (currentIndex >= newWords.length && newWords.length > 0) {
				setCurrentIndex(newWords.length - 1);
			}
			fetchProgress();
			if (newWords.length <= PAGE_SIZE * 2 && hasMore && !loadingRef.current) {
				fetchPage(pageRef.current + 1, true);
			}
		} catch (e) {
			console.error('Failed to move word:', e);
		}
	}, [words, currentIndex, fetchProgress, hasMore, fetchPage]);

	const detectDropTarget = useCallback((moveX: number, moveY: number): string | null => {
		for (const [key, layout] of Object.entries(buttonLayouts)) {
			if (
				moveX >= layout.x && moveX <= layout.x + layout.width &&
				moveY >= layout.y && moveY <= layout.y + layout.height
			) {
				return key;
			}
		}
		return null;
	}, [buttonLayouts]);

	const panResponder = useRef(
		PanResponder.create({
			onMoveShouldSetPanResponder: (evt, gestureState) =>
				Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && Math.abs(gestureState.dy) > 10,
			onPanResponderGrant: () => {
				setIsDragging(true);
				pan.setValue({ x: 0, y: 0 });
			},
			onPanResponderMove: (evt, gestureState) => {
				pan.setValue({ x: gestureState.dx, y: gestureState.dy });
				const target = detectDropTarget(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
				setDropTarget(target);
			},
			onPanResponderRelease: (evt, gestureState) => {
				setIsDragging(false);
				dragJustEnded.current = true;
				setTimeout(() => { dragJustEnded.current = false; }, 200);
				const target = detectDropTarget(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
				setDropTarget(null);
				if (target && currentWord) {
					handleMoveWord(currentWord, CATEGORY_CONFIG[target as keyof typeof CATEGORY_CONFIG].status);
				}
				Animated.spring(pan, {
					toValue: { x: 0, y: 0 },
					useNativeDriver: false,
					friction: 5,
				}).start();
			},
			onPanResponderTerminate: () => {
				setIsDragging(false);
				setDropTarget(null);
				Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 5 }).start();
			},
		})
	).current;

	const onButtonLayout = useCallback((key: string) => (event: any) => {
		buttonRefs[key]?.measure((fx: number, fy: number, width: number, height: number, px: number, py: number) => {
			setButtonLayouts(prev => ({ ...prev, [key]: { x: px, y: py, width, height } }));
		});
	}, [buttonRefs]);

	const renderWordCard = useCallback(({ item, index }: { item: Word; index: number }) => {
		const isCurrent = index === currentIndex;
		return (
			<View style={styles.cardContainer}>
				{isCurrent ? (
					<Animated.View
						style={[
							styles.wordCard,
							{
								transform: [{ translateX: pan.x }, { translateY: pan.y }],
								opacity: isDragging ? 0.9 : 1,
								zIndex: isDragging ? 100 : 1,
							},
						]}
						{...panResponder.panHandlers}
					>
						<View style={styles.cardHeader}>
							<Text style={styles.indexText}>{index + 1} / {words.length}</Text>
						</View>
						<Text style={styles.wordText}>{item.word}</Text>
						<Text style={styles.phoneticText}>{item.phonetic}</Text>
						<Text style={styles.meaningText}>{item.meaning}</Text>
						{isDragging && (
							<View style={styles.dragHintContainer}>
								<Text style={styles.dragHintText}>
									{dropTarget ? `松手放入${CATEGORY_CONFIG[dropTarget as keyof typeof CATEGORY_CONFIG]?.label || ''}` : '拖动到下方按钮'}
								</Text>
							</View>
						)}
					</Animated.View>
				) : (
					<View style={styles.wordCard}>
						<View style={styles.cardHeader}>
							<Text style={styles.indexText}>{index + 1} / {words.length}</Text>
						</View>
						<Text style={styles.wordText}>{item.word}</Text>
						<Text style={styles.phoneticText}>{item.phonetic}</Text>
						<Text style={styles.meaningText}>{item.meaning}</Text>
					</View>
				)}
			</View>
		);
	}, [words.length, currentIndex, isDragging, dropTarget, pan, panResponder.panHandlers]);

	const handleScroll = useCallback((event: any) => {
		const offsetX = event.nativeEvent.contentOffset.x;
		setCurrentIndex(Math.round(offsetX / SCREEN_WIDTH));
	}, []);

	const currentWord = words[currentIndex];

	const navigateToCategory = useCallback((route: string) => {
		router.push(route);
	}, [router]);

	return (
		<Screen>
			<View style={styles.container}>
				<View style={styles.header}>
					<TouchableOpacity
						style={styles.backButton}
						onPress={() => {
							if (router.canGoBack && router.canGoBack()) {
								router.back();
							} else {
								router.replace('/');
							}
						}}
						activeOpacity={0.6}
					>
						<FontAwesome6 name="arrow-left" size={18} color="#1F2937" />
					</TouchableOpacity>
					<View style={styles.headerLeft}>
						<Text style={styles.headerTitle}>四级词汇</Text>
						<Text style={styles.headerCount}>
							{isLoading ? '加载中...' : `${pendingCount} 个单词待学习`}
						</Text>
					</View>
					<TouchableOpacity style={styles.refreshButton} onPress={() => fetchPage(1, false)}>
						<Text style={styles.refreshText}>刷新</Text>
					</TouchableOpacity>
				</View>

				<View style={styles.cardsSection}>
					{words.length > 0 ? (
						<>
							<FlatList
								data={words}
								renderItem={renderWordCard}
								keyExtractor={(item) => item.id.toString()}
								horizontal
								pagingEnabled
								showsHorizontalScrollIndicator={false}
								onScroll={handleScroll}
								scrollEventThrottle={16}
								onEndReached={loadMore}
								onEndReachedThreshold={0.3}
								getItemLayout={(data, index) => ({
									length: SCREEN_WIDTH,
									offset: SCREEN_WIDTH * index,
									index,
								})}
							/>
							<View style={styles.indicatorContainer}>
								{words.map((_, index) => (
									<View
										key={index}
										style={[styles.indicatorDot, index === currentIndex && styles.indicatorDotActive]}
									/>
								))}
							</View>
						</>
					) : (
						<View style={styles.emptyContainer}>
							{error ? (
								<Text style={styles.errorText}>加载失败: {error}</Text>
							) : (
								<Text style={styles.emptyText}>四级词汇已分类完成！</Text>
							)}
						</View>
					)}
				</View>

				{currentWord && (
					<View style={styles.actionSection}>
						<Text style={styles.actionHint}>
							{isDragging ? '松手放入对应分类' : '长按拖动单词到按钮分类，单击按钮查看列表'}
						</Text>
						<View style={styles.actionRow}>
							{(Object.entries(CATEGORY_CONFIG) as [string, { label: string; color: string; route: string }][]).map(([key, config]) => (
								<TouchableOpacity
									key={key}
									ref={(ref) => { buttonRefs[key] = ref; }}
									onLayout={onButtonLayout(key)}
									style={[styles.actionButton, { backgroundColor: config.color }, dropTarget === key && styles.actionButtonActive]}
									onPress={() => {
										if (dragJustEnded.current) return;
										navigateToCategory(config.route);
									}}
									activeOpacity={0.8}
								>
									<Text style={styles.actionButtonText}>{config.label}</Text>
									<Text style={styles.actionButtonCount}>
										({categoryCounts[key as keyof typeof categoryCounts]})
									</Text>
								</TouchableOpacity>
							))}
						</View>
					</View>
				)}

				<View style={styles.statsSection}>
					<View style={styles.statsRow}>
						{(Object.entries(CATEGORY_CONFIG) as [string, { label: string; color: string }][]).map(([key, config]) => (
							<View key={key} style={[styles.statsItem, { backgroundColor: config.color }]}>
								<Text style={styles.statsLabel}>{config.label}</Text>
								<Text style={styles.statsCount}>{categoryCounts[key as keyof typeof categoryCounts]}</Text>
							</View>
						))}
					</View>
				</View>
			</View>
		</Screen>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: '#F3F4F6' },
	header: {
		backgroundColor: '#FFFFFF',
		paddingHorizontal: 16,
		paddingVertical: 14,
		borderBottomWidth: 1,
		borderBottomColor: '#E5E7EB',
		flexDirection: 'row',
		alignItems: 'center',
	},
	backButton: { padding: 6, marginRight: 10 },
	headerLeft: { flex: 1 },
	headerTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937' },
	headerCount: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
	refreshButton: { backgroundColor: '#3B82F6', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
	refreshText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
	cardsSection: { flex: 1, justifyContent: 'center' },
	cardContainer: { width: SCREEN_WIDTH, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
	wordCard: {
		width: CARD_WIDTH,
		backgroundColor: '#FFFFFF',
		borderRadius: 20,
		padding: 28,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.06,
		shadowRadius: 8,
		elevation: 4,
		minHeight: 320,
	},
	cardHeader: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 },
	indexText: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
	wordText: { fontSize: 40, fontWeight: '800', color: '#1F2937', textAlign: 'center', marginTop: 8 },
	phoneticText: { fontSize: 16, color: '#6B7280', marginTop: 10, textAlign: 'center' },
	meaningText: { fontSize: 15, color: '#3B82F6', marginTop: 20, textAlign: 'center', lineHeight: 24, fontWeight: '500' },
	dragHintContainer: { marginTop: 20, alignItems: 'center' },
	dragHintText: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },
	indicatorContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12 },
	indicatorDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D1D5DB', marginHorizontal: 3 },
	indicatorDotActive: { backgroundColor: '#3B82F6', width: 18 },
	emptyContainer: { alignItems: 'center', paddingVertical: 60 },
	emptyText: { fontSize: 16, color: '#9CA3AF' },
	errorText: { fontSize: 14, color: '#F87171' },
	actionSection: { paddingHorizontal: 16, paddingBottom: 12 },
	actionHint: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginBottom: 10 },
	actionRow: { flexDirection: 'row', justifyContent: 'space-between' },
	actionButton: {
		flex: 1,
		marginHorizontal: 6,
		paddingVertical: 14,
		borderRadius: 12,
		alignItems: 'center',
	},
	actionButtonActive: { opacity: 0.85, transform: [{ scale: 1.05 }] },
	actionButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
	actionButtonCount: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 2 },
	statsSection: { paddingHorizontal: 16, paddingBottom: 20 },
	statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
	statsItem: { flex: 1, marginHorizontal: 6, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
	statsLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 13 },
	statsCount: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginTop: 2 },
});