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
	Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { fetchWithRetry } from '@/utils/apiClient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;

interface Word {
	id: number;
	word: string;
	meaning: string;
	phonetic: string;
	example?: string;
	example_translation?: string;
	translation?: string;
	image_url?: string;
}

const CATEGORY_CONFIG = {
	x: { label: '已会', color: '#4CAF50', route: '/known-words' as const },
	y: { label: '模糊', color: '#FF9800', route: '/vague-words' as const },
	z: { label: '不会', color: '#F44336', route: '/unknown-words' as const },
};

export default function WordPreviewPage() {
	const router = useSafeRouter();
	const params = useSafeSearchParams<{ category?: string; categoryId?: string }>();
	const [words, setWords] = useState<Word[]>([]);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [categoryCounts, setCategoryCounts] = useState({ x: 0, y: 0, z: 0 });
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const flatListRef = useRef<FlatList>(null);

	// 拖拽动画
	const pan = useRef(new Animated.ValueXY()).current;
	const [isDragging, setIsDragging] = useState(false);
	const [dropTarget, setDropTarget] = useState<string | null>(null);
	// 用于防止拖拽释放时意外触发按钮的 onPress
	const dragJustEnded = useRef(false);

	// 按钮区域引用和布局
	const buttonRefs = useRef<{ [key: string]: View | null }>({}).current;
	const [buttonLayouts, setButtonLayouts] = useState<{
		[key: string]: { x: number; y: number; width: number; height: number };
	}>({});

	// 获取 words_b 的单词
	const fetchWords = useCallback(async () => {
		try {
			setIsLoading(true);
			setError(null);

			const response = await fetchWithRetry(`/api/v1/user-words/category/a?page=1&limit=200`);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const data = await response.json();
			setWords(data);
			setCurrentIndex(0);
		} catch (error: any) {
			console.error('Failed to fetch words:', error);
			setError(error.message || '获取单词列表失败');
		} finally {
			setIsLoading(false);
		}
	}, []);

	// 获取分类计数
	const fetchCategoryCounts = useCallback(async () => {
		try {
			const [xRes, yRes, zRes] = await Promise.all([
				fetchWithRetry(`/api/v1/user-words/category/x/count`),
				fetchWithRetry(`/api/v1/user-words/category/y/count`),
				fetchWithRetry(`/api/v1/user-words/category/z/count`),
			]);

			const [xData, yData, zData] = await Promise.all([
				xRes.json(),
				yRes.json(),
				zRes.json(),
			]);

			setCategoryCounts({
				x: xData.count || 0,
				y: yData.count || 0,
				z: zData.count || 0,
			});
		} catch (error) {
			console.error('Failed to fetch category counts:', error);
		}
	}, []);

	// 页面加载时获取数据
	useEffect(() => {
		const timer = setTimeout(() => {
			fetchWords();
			fetchCategoryCounts();
		}, 0);
		return () => clearTimeout(timer);
	}, [fetchWords, fetchCategoryCounts]);

	useFocusEffect(
		useCallback(() => {
			fetchWords();
			fetchCategoryCounts();
		}, [fetchWords, fetchCategoryCounts])
	);

	// 移动单词到分类
	const handleMoveWord = useCallback(async (word: Word, targetTable: string) => {
		try {
			console.log('[handleMoveWord] Moving word:', word.id, word.word, 'to', targetTable);
			const response = await fetchWithRetry(`/api/v1/user-words/classify`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					wordId: word.id,
					targetTable: targetTable
				})
			});

			const result = await response.json();
			console.log('[handleMoveWord] Response:', response.status, result);

			if (!response.ok) {
				throw new Error(result.error || '移动失败');
			}

			// 从列表中移除当前单词
			const newWords = words.filter(w => w.id !== word.id);
			setWords(newWords);

			// 更新索引
			if (currentIndex >= newWords.length && newWords.length > 0) {
				setCurrentIndex(newWords.length - 1);
			}

			// 更新分类数量
			fetchCategoryCounts();
		} catch (error) {
			console.error('Failed to move word:', error);
			Alert.alert('错误', '移动失败，请重试');
		}
	}, [words, currentIndex, fetchCategoryCounts]);

	// 检测拖拽释放位置是否在按钮区域内
	const detectDropTarget = useCallback((moveX: number, moveY: number): string | null => {
		for (const [key, layout] of Object.entries(buttonLayouts)) {
			if (
				moveX >= layout.x &&
				moveX <= layout.x + layout.width &&
				moveY >= layout.y &&
				moveY <= layout.y + layout.height
			) {
				return key;
			}
		}
		return null;
	}, [buttonLayouts]);

	// PanResponder 用于拖拽当前卡片
	const panResponder = useRef(
		PanResponder.create({
			onMoveShouldSetPanResponder: (evt, gestureState) => {
				// 只有垂直方向移动超过 10px 才捕获
				return Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && Math.abs(gestureState.dy) > 10;
			},
			onPanResponderGrant: () => {
				setIsDragging(true);
				pan.setValue({ x: 0, y: 0 });
			},
			onPanResponderMove: (evt, gestureState) => {
				pan.setValue({ x: gestureState.dx, y: gestureState.dy });

				// 实时检测悬停的按钮（使用 pageX/pageY 更可靠）
				const pageX = evt.nativeEvent.pageX;
				const pageY = evt.nativeEvent.pageY;
				const target = detectDropTarget(pageX, pageY);
				setDropTarget(target);
			},
			onPanResponderRelease: (evt, gestureState) => {
				setIsDragging(false);
					// 标记拖拽刚刚结束，防止触发按钮 onPress
					dragJustEnded.current = true;
					setTimeout(() => { dragJustEnded.current = false; }, 200);
				// 使用 pageX/pageY 获取全局坐标
				const pageX = evt.nativeEvent.pageX;
				const pageY = evt.nativeEvent.pageY;
				console.log('[Drag] Release pageX:', pageX, 'pageY:', pageY);
				console.log('[Drag] gestureState moveX:', gestureState.moveX, 'moveY:', gestureState.moveY);
				console.log('[Drag] Button layouts:', JSON.stringify(buttonLayouts));
				const target = detectDropTarget(pageX, pageY);
				console.log('[Drag] Detected target:', target);
				setDropTarget(null);

				if (target && currentWord) {
					console.log('[Drag] Calling handleMoveWord for', currentWord.word, 'id=', currentWord.id, 'target=', target);
					// 执行分类
					handleMoveWord(currentWord, target);
				} else {
					console.log('[Drag] No drop target or no currentWord. target=', target, 'currentWord=', currentWord?.word);
				}

				// 弹回原位
				Animated.spring(pan, {
					toValue: { x: 0, y: 0 },
					useNativeDriver: false,
					friction: 5,
				}).start();
			},
			onPanResponderTerminate: () => {
				setIsDragging(false);
				setDropTarget(null);
				Animated.spring(pan, {
					toValue: { x: 0, y: 0 },
					useNativeDriver: false,
					friction: 5,
				}).start();
			},
		})
	).current;

	// 按钮布局回调
	const onButtonLayout = useCallback((key: string) => (event: any) => {
		const layout = event.nativeEvent.layout;
		// 使用 measure 获取相对于屏幕的绝对位置
		buttonRefs[key]?.measure((fx: number, fy: number, width: number, height: number, px: number, py: number) => {
			setButtonLayouts(prev => ({
				...prev,
				[key]: { x: px, y: py, width, height }
			}));
		});
	}, [buttonRefs]);

	// 渲染单词卡片
	const renderWordCard = useCallback(({ item, index }: { item: Word; index: number }) => {
		const isCurrent = index === currentIndex;

		return (
			<View style={styles.cardContainer}>
				{isCurrent ? (
					<Animated.View
						style={[
							styles.wordCard,
							{
								transform: [
									{ translateX: pan.x },
									{ translateY: pan.y },
								],
								opacity: isDragging ? 0.9 : 1,
								zIndex: isDragging ? 100 : 1,
							},
						]}
						{...panResponder.panHandlers}
					>
						{/* Page number */}
						<View style={styles.cardHeader}>
							<Text style={styles.indexText}>{index + 1} / {words.length}</Text>
						</View>

						{/* Word */}
						<Text style={styles.wordText}>{item.word}</Text>

						{/* Phonetic */}
						<Text style={styles.phoneticText}>{item.phonetic}</Text>

						{/* Meaning */}
						<Text style={styles.meaningText}>{item.meaning}</Text>

						{/* Divider + Example */}
						{item.example && (
							<View style={styles.exampleSection}>
								<View style={styles.divider} />
								<Text style={styles.exampleText}>{item.example}</Text>
								{item.example_translation && (
									<Text style={styles.exampleTranslation}>{item.example_translation}</Text>
								)}
							</View>
						)}

						{/* Drag hint */}
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
						{item.example && (
							<View style={styles.exampleSection}>
								<View style={styles.divider} />
								<Text style={styles.exampleText}>{item.example}</Text>
								{item.example_translation && (
									<Text style={styles.exampleTranslation}>{item.example_translation}</Text>
								)}
							</View>
						)}
					</View>
				)}
			</View>
		);
	}, [words.length, currentIndex, isDragging, dropTarget, pan, panResponder.panHandlers]);

	// 处理滚动事件
	const handleScroll = useCallback((event: any) => {
		const offsetX = event.nativeEvent.contentOffset.x;
		const newIndex = Math.round(offsetX / SCREEN_WIDTH);
		setCurrentIndex(newIndex);
	}, []);

	// 当前单词
	const currentWord = words[currentIndex];

	const headerSubtitle = params.category
		? `${params.category} · ${words.length} 个单词`
		: `${words.length} 个单词待分类`;

	// 导航到分类列表
	const navigateToCategory = useCallback((route: string) => {
		router.push(route);
	}, [router]);

	return (
		<Screen>
			<View style={styles.container}>
				{/* Header */}
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
						<Text style={styles.headerTitle}>词汇预览</Text>
						<Text style={styles.headerCount}>
							{isLoading ? '加载中...' : headerSubtitle}
						</Text>
					</View>
					<TouchableOpacity style={styles.refreshButton} onPress={fetchWords}>
						<Text style={styles.refreshText}>刷新</Text>
					</TouchableOpacity>
				</View>

				{/* Word Cards - Horizontal Scroll */}
				<View style={styles.cardsSection}>
					{words.length > 0 ? (
						<>
							<FlatList
								ref={flatListRef}
								data={words}
								renderItem={renderWordCard}
								keyExtractor={(item) => item.id.toString()}
								horizontal
								pagingEnabled
								showsHorizontalScrollIndicator={false}
								onScroll={handleScroll}
								scrollEventThrottle={16}
								getItemLayout={(data, index) => ({
									length: SCREEN_WIDTH,
									offset: SCREEN_WIDTH * index,
									index,
								})}
							/>

							{/* Page Indicator */}
							<View style={styles.indicatorContainer}>
								{words.map((_, index) => (
									<View
										key={index}
										style={[
											styles.indicatorDot,
											index === currentIndex && styles.indicatorDotActive,
										]}
									/>
								))}
							</View>
						</>
					) : (
						<View style={styles.emptyContainer}>
							{error ? (
								<>
									<Text style={styles.errorText}>加载失败: {error}</Text>
								</>
							) : (
								<Text style={styles.emptyText}>所有单词已分类完成！</Text>
							)}
						</View>
					)}
				</View>

				{/* Action Buttons - Drop Targets */}
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
									style={[
										styles.actionButton,
										{ backgroundColor: config.color },
										dropTarget === key && styles.actionButtonActive,
									]}
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

				{/* Category Stats */}
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
	container: {
		flex: 1,
		backgroundColor: '#F3F4F6',
	},
	header: {
		backgroundColor: '#FFFFFF',
		paddingHorizontal: 16,
		paddingVertical: 14,
		borderBottomWidth: 1,
		borderBottomColor: '#E5E7EB',
		flexDirection: 'row',
		alignItems: 'center',
	},
	backButton: {
		padding: 6,
		marginRight: 10,
	},
	headerLeft: {
		flex: 1,
	},
	headerTitle: {
		fontSize: 20,
		fontWeight: '700',
		color: '#1F2937',
	},
	headerCount: {
		fontSize: 13,
		color: '#9CA3AF',
		marginTop: 2,
	},
	refreshButton: {
		backgroundColor: '#3B82F6',
		paddingHorizontal: 14,
		paddingVertical: 7,
		borderRadius: 8,
	},
	refreshText: {
		color: '#FFFFFF',
		fontSize: 13,
		fontWeight: '600',
	},
	cardsSection: {
		flex: 1,
		justifyContent: 'center',
	},
	cardContainer: {
		width: SCREEN_WIDTH,
		paddingHorizontal: 16,
		justifyContent: 'center',
		alignItems: 'center',
	},
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
	cardHeader: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		marginBottom: 12,
	},
	indexText: {
		fontSize: 13,
		color: '#9CA3AF',
		fontWeight: '500',
	},
	wordText: {
		fontSize: 40,
		fontWeight: '800',
		color: '#1F2937',
		textAlign: 'center',
		marginTop: 8,
	},
	phoneticText: {
		fontSize: 16,
		color: '#6B7280',
		marginTop: 10,
		textAlign: 'center',
	},
	meaningText: {
		fontSize: 15,
		color: '#3B82F6',
		marginTop: 20,
		textAlign: 'center',
		lineHeight: 24,
		fontWeight: '500',
	},
	exampleSection: {
		marginTop: 24,
	},
	divider: {
		height: 1,
		backgroundColor: '#E5E7EB',
		marginBottom: 16,
	},
	exampleText: {
		fontSize: 14,
		color: '#9CA3AF',
		lineHeight: 22,
		textAlign: 'center',
		fontStyle: 'italic',
	},
	exampleTranslation: {
		fontSize: 13,
		color: '#9CA3AF',
		lineHeight: 20,
		textAlign: 'center',
		marginTop: 6,
	},
	indicatorContainer: {
		flexDirection: 'row',
		justifyContent: 'center',
		alignItems: 'center',
		paddingVertical: 16,
		gap: 8,
	},
	indicatorDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: '#D1D5DB',
	},
	indicatorDotActive: {
		width: 24,
		backgroundColor: '#3B82F6',
	},
	emptyContainer: {
		padding: 48,
		alignItems: 'center',
		justifyContent: 'center',
	},
	emptyText: {
		fontSize: 16,
		color: '#9CA3AF',
		textAlign: 'center',
	},
	errorText: {
		fontSize: 14,
		color: '#EF4444',
		marginBottom: 8,
		textAlign: 'center',
	},
	actionSection: {
		backgroundColor: '#FFFFFF',
		paddingHorizontal: 16,
		paddingVertical: 18,
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: -4 },
		shadowOpacity: 0.08,
		shadowRadius: 12,
		elevation: 10,
	},
	actionHint: {
		fontSize: 12,
		color: '#9CA3AF',
		textAlign: 'center',
		marginBottom: 14,
	},
	actionRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		gap: 12,
	},
	actionButton: {
		flex: 1,
		paddingVertical: 14,
		borderRadius: 14,
		alignItems: 'center',
		borderWidth: 2,
		borderColor: 'transparent',
	},
	actionButtonActive: {
		borderColor: '#FFFFFF',
		transform: [{ scale: 1.05 }],
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 8,
		elevation: 8,
	},
	actionButtonText: {
		fontSize: 15,
		fontWeight: '600',
		color: '#FFFFFF',
	},
	actionButtonCount: {
		fontSize: 13,
		color: '#FFFFFF',
		opacity: 0.8,
		marginTop: 2,
	},
	statsSection: {
		backgroundColor: '#FFFFFF',
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderTopWidth: 1,
		borderTopColor: '#F3F4F6',
	},
	statsRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		gap: 10,
	},
	statsItem: {
		flex: 1,
		borderRadius: 10,
		paddingVertical: 8,
		alignItems: 'center',
	},
	statsLabel: {
		fontSize: 11,
		color: '#FFFFFF',
		opacity: 0.9,
	},
	statsCount: {
		fontSize: 16,
		fontWeight: '700',
		color: '#FFFFFF',
		marginTop: 2,
	},
	dragHintContainer: {
		marginTop: 16,
		paddingVertical: 8,
		paddingHorizontal: 16,
		backgroundColor: '#EBF5FF',
		borderRadius: 8,
		alignItems: 'center',
	},
	dragHintText: {
		fontSize: 13,
		color: '#3B82F6',
		fontWeight: '600',
	},
});
