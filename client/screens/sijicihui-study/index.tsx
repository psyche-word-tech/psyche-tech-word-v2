/* 四级词汇学习页 —— 复刻高中 learn 页的字体/尺寸/按钮位置与拖动交互，数据走 sijicihui + 按用户隔离 */
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, PanResponder } from 'react-native';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { FontAwesome6 } from '@expo/vector-icons';
import { fetchWithRetry } from '@/utils/apiClient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Word {
	id: number;
	word: string;
	phonetic?: string;
	meaning: string;
	status?: string;
}

const STATUS_MAP: Record<number, string> = { 1: 'known', 2: 'vague', 3: 'unknown' };

interface DraggableWordCardProps {
	word: Word;
	onDrop: (wordId: number, categoryId: number) => void;
	onPress: () => void;
	onDoublePress: () => void;
}

function DraggableWordCard({ word, onDrop, onPress, onDoublePress }: DraggableWordCardProps) {
	const pan = useRef(new Animated.ValueXY()).current;
	const [isDragging, setIsDragging] = useState(false);
	const lastTapRef = useRef(0);
	const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
				onPanResponderMove: (evt, gestureState) => {
					pan.setValue({ x: gestureState.dx, y: gestureState.dy });
				},
				onPanResponderRelease: (evt, gestureState) => {
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
						lastTapRef.current = 0;
					} else if (Math.abs(gestureState.dx) < 6 && Math.abs(dy) < 6) {
						// 轻点：区分单击(进详情) / 双击(标记"不会")
						const now = Date.now();
						if (now - lastTapRef.current < 320) {
							if (singleTapTimer.current) {
								clearTimeout(singleTapTimer.current);
								singleTapTimer.current = null;
							}
							lastTapRef.current = 0;
							onDoublePress();
						} else {
							lastTapRef.current = now;
							if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
							singleTapTimer.current = setTimeout(() => onPress(), 300);
						}
					} else {
						lastTapRef.current = 0;
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
		[onDrop, onPress, onDoublePress, word.id, pan]
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
			<View style={styles.wordCard}>
				<Text style={styles.wordCardText}>{word.word}</Text>
			</View>
		</Animated.View>
	);
}

export default function SijicihuiStudyPage() {
	const router = useSafeRouter();

	const [allWords, setAllWords] = useState<Word[]>([]);
	const [pending, setPending] = useState(0);
	const [categoryCounts, setCategoryCounts] = useState({ known: 0, vague: 0, unknown: 0 });
	const [error, setError] = useState<string | null>(null);
	const pageRef = useRef(1);
	const pageSize = 50;

	const categoryColors = ['#4CAF50', '#FF9800', '#F44336'];
	const categoryNames = ['已会', '模糊', '不会'];

	const displayWords = allWords.slice(0, 3);
	const remainingCount = pending;

	const refreshCounts = useCallback(async () => {
		try {
			const res = await fetchWithRetry('/api/v1/sijicihui-study/progress');
			const json = await res.json();
			if (json?.success && json.data) {
				setPending(json.data.pending ?? 0);
				setCategoryCounts({
					known: json.data.known ?? 0,
					vague: json.data.vague ?? 0,
					unknown: json.data.unknown ?? 0,
				});
			}
		} catch (err) {
			console.error('refreshCounts failed', err);
		}
	}, []);

	const loadWords = useCallback(async (page = 1, append = false) => {
		try {
			const res = await fetchWithRetry(`/api/v1/sijicihui-study/words?status=&page=${page}&limit=${pageSize}`);
			const json = await res.json();
			if (json?.success && Array.isArray(json.data)) {
				setAllWords((prev) => (append ? [...prev, ...json.data] : json.data));
				pageRef.current = page + 1;
			}
		} catch (err: any) {
			setError(err?.message || '网络请求失败');
		}
	}, []);

	// 拖动后若当前窗口不足补拉，保证下方卡片始终够数
	useEffect(() => {
		if (allWords.length < 3 && allWords.length > 0) {
			loadWords(pageRef.current, true);
		}
	}, [allWords.length, loadWords]);

	const handleDrop = useCallback(
		async (wordId: number, categoryId: number) => {
			const status = STATUS_MAP[categoryId];
			try {
				const response = await fetchWithRetry('/api/v1/sijicihui-study/status', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ wordId, status }),
				});
				const result = await response.json();
				if (!response.ok || !result?.success) {
					throw new Error(result?.message || '记录失败');
				}
			} catch (err) {
				console.error('Failed to move word:', err);
				return;
			}
			setAllWords((prev) => prev.filter((w) => w.id !== wordId));
			setPending((p) => Math.max(0, p - 1));
			refreshCounts();
		},
		[refreshCounts]
	);

	const handleWordPress = (word: Word) => {
		router.push('/sijicihui-word-detail', {
			word: JSON.stringify({
				id: word.id,
				word: word.word,
				phonetic: word.phonetic,
				meaning: word.meaning,
			}),
		});
	};

	const fetchData = useCallback(async () => {
		setError(null);
		refreshCounts();
		loadWords(1, false);
	}, [refreshCounts, loadWords]);

	useEffect(() => {
		const timer = setTimeout(() => fetchData(), 0);
		return () => clearTimeout(timer);
	}, [fetchData]);

	return (
		<Screen>
			<View style={styles.container}>
				<View style={styles.header}>
					<TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
						<Text style={styles.backText}>back</Text>
					</TouchableOpacity>
					<View style={styles.headerCenter}>
						<Text style={styles.title}>四级词汇</Text>
						<View style={styles.headerSub}>
							<Text style={styles.pendingSubText}>{pending} 个单词待学习</Text>
						</View>
					</View>
					<TouchableOpacity onPress={() => fetchData()} style={styles.refreshButton}>
						<FontAwesome6 name="rotate-right" size={16} color="#333" />
					</TouchableOpacity>
				</View>

				<View style={styles.centerContainer}>
					<View style={styles.content}>
						<Text style={styles.remainingText}>剩余 {remainingCount} 个单词</Text>
						{allWords.length > 0 ? (
							<View style={styles.wordRow}>
								{displayWords.map((word) => (
									<DraggableWordCard
										key={word.id}
										word={word}
										onDrop={handleDrop}
										onPress={() => handleWordPress(word)}
										onDoublePress={() => handleDrop(word.id, 3)}
									/>
								))}
							</View>
						) : allWords.length === 0 && pending === 0 ? (
							<View style={styles.emptyContainer}>
								<Text style={styles.emptyText}>所有单词已分类完成！</Text>
							</View>
						) : null}
						{error ? <Text style={styles.errorText}>{error}</Text> : null}
					</View>
				</View>

				<View style={styles.categorySection}>
					<View style={styles.categoryRow}>
						{[1, 2, 3].map((id) => {
							const count = id === 1 ? categoryCounts.known : id === 2 ? categoryCounts.vague : categoryCounts.unknown;
							return (
								<View key={id} style={styles.categoryItem}>
									<View style={[styles.categoryCard, { backgroundColor: categoryColors[id - 1] }]}>
										<Text style={styles.categoryName}>{categoryNames[id - 1]}</Text>
										<Text style={styles.categoryCount}>({count})</Text>
									</View>
								</View>
								);
							})}
					</View>
					<Text style={styles.instructionText}>拖动单词到上方分类区域</Text>
				</View>
			</View>
		</Screen>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#FFFFFF',
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: 20,
		backgroundColor: '#E5E5E5',
	},
	headerCenter: {
		alignItems: 'center',
	},
	backButton: {
		width: 50,
	},
	backText: {
		fontSize: 14,
		color: '#000000',
	},
	title: {
		fontSize: 16,
		color: '#333333',
		fontWeight: '600',
	},
	headerSub: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 4,
	},
	pendingSubText: {
		fontSize: 10,
		color: '#666',
	},
	refreshButton: {
		width: 50,
		alignItems: 'flex-end',
	},
	centerContainer: {
		flex: 1,
		justifyContent: 'center',
		paddingHorizontal: 20,
	},
	content: {
		paddingVertical: 16,
		alignItems: 'center',
		transform: [{ translateY: -100 }],
	},
	remainingText: {
		fontSize: 14,
		color: '#999999',
		marginBottom: 20,
	},
	wordRow: {
		flexDirection: 'row',
		gap: 28,
		justifyContent: 'center',
	},
	wordItemContainer: {
		width: 68,
	},
	wordCard: {
		backgroundColor: '#F0F0F0',
		paddingHorizontal: 6,
		paddingVertical: 8,
		borderRadius: 8,
		alignItems: 'center',
		minHeight: 60,
		justifyContent: 'center',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
	},
	wordCardText: {
		fontSize: 12,
		color: '#333333',
		fontWeight: '600',
	},
	categorySection: {
		paddingVertical: 10,
		backgroundColor: '#FFFFFF',
		transform: [{ translateY: -200 }],
	},
	categoryRow: {
		flexDirection: 'row',
		gap: 10,
	},
	categoryItem: {
		flex: 1,
	},
	categoryCard: {
		paddingVertical: 10,
		borderRadius: 10,
		alignItems: 'center',
	},
	categoryName: {
		fontSize: 13,
		color: '#FFFFFF',
		fontWeight: '600',
	},
	categoryCount: {
		fontSize: 11,
		color: 'rgba(255,255,255,0.8)',
		marginTop: 2,
	},
	translationText: {
		fontSize: 9,
		color: 'rgba(255,255,255,0.7)',
		textAlign: 'center',
		marginTop: 4,
		lineHeight: 12,
	},
	instructionText: {
		fontSize: 11,
		color: '#999999',
		textAlign: 'center',
		marginTop: 6,
	},
	emptyContainer: {
		padding: 48,
		alignItems: 'center',
	},
	emptyText: {
		fontSize: 16,
		color: '#999999',
	},
	errorText: {
		fontSize: 14,
		color: '#E53935',
		marginBottom: 8,
	},
});