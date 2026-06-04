/* eslint-disable react-hooks/refs */
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, PanResponder } from 'react-native';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { useFocusEffect } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { fetchWithRetry } from '@/utils/apiClient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Word {
	id: number;
	word: string;
	meaning: string;
	phonetic?: string;
	example?: string;
	example_translation?: string;
	image_url?: string;
}

interface DraggableWordCardProps {
	word: Word;
	onDrop: (wordId: number, categoryId: number) => void;
	onPress: () => void;
}

function DraggableWordCard({ word, onDrop, onPress }: DraggableWordCardProps) {
	const pan = useRef(new Animated.ValueXY()).current;
	const [isDragging, setIsDragging] = useState(false);

	const panResponder = useMemo(() =>
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
					transform: [
						{ translateX: pan.x },
						{ translateY: pan.y },
					],
					opacity: isDragging ? 0.8 : 1,
					zIndex: isDragging ? 100 : 1,
				},
			]}
		>
			<TouchableOpacity onPress={onPress} activeOpacity={0.7}>
					<View style={styles.wordCard}>
						<Text style={styles.wordCardText}>{word.word}</Text>
						{word.example_translation ? (
							<Text style={styles.translationText} numberOfLines={2}>
								{word.example_translation}
							</Text>
						) : null}
					</View>
			</TouchableOpacity>
		</Animated.View>
	);
}

export default function LearnPage() {
	const router = useSafeRouter();
	const params = useSafeSearchParams<{ table?: string }>();
	const table = params.table || 'b';
	
	const [allWords, setAllWords] = useState<Word[]>([]);
	const [categoryCounts, setCategoryCounts] = useState({ x: 0, y: 0, z: 0 });
	const [error, setError] = useState<string | null>(null);

	const categoryColors = ['#4CAF50', '#FF9800', '#F44336'];
	const categoryNames = ['已会', '模糊', '不会'];

	const displayWords = allWords.slice(0, 3);
	const remainingCount = allWords.length;

	const fetchData = useCallback(async () => {
		setError(null);
		try {
			const [wordsRes, xRes, yRes, zRes] = await Promise.all([
				fetchWithRetry(`/api/v1/wordbooks/${table}`),
				fetchWithRetry(`/api/v1/wordbooks/x`),
				fetchWithRetry(`/api/v1/wordbooks/y`),
				fetchWithRetry(`/api/v1/wordbooks/z`)
			]);

			const wordsData = await wordsRes.json();
			const xResult = await xRes.json();
			const yResult = await yRes.json();
			const zResult = await zRes.json();

			const xIds = new Set(Array.isArray(xResult) ? xResult.map((w: any) => w.id) : []);
			const yIds = new Set(Array.isArray(yResult) ? yResult.map((w: any) => w.id) : []);
			const zIds = new Set(Array.isArray(zResult) ? zResult.map((w: any) => w.id) : []);

			const allWordsData = Array.isArray(wordsData) ? wordsData : [];
			const filteredWords = allWordsData.filter((w: any) => !xIds.has(w.id) && !yIds.has(w.id) && !zIds.has(w.id));

			// 按钮显示全局分类数量（words_x/y/z 的总数）
			setAllWords(filteredWords);
			setCategoryCounts({
				x: Array.isArray(xResult) ? xResult.length : 0,
				y: Array.isArray(yResult) ? yResult.length : 0,
				z: Array.isArray(zResult) ? zResult.length : 0,
			});
		} catch (err: any) {
			console.error('Failed to fetch data:', err);
			setError(err?.message || '网络请求失败');
		}
	}, [table]);

	useEffect(() => {
		const timer = setTimeout(() => {
			fetchData();
		}, 0);
		return () => clearTimeout(timer);
	}, [fetchData]);

	useFocusEffect(
		useCallback(() => {
			fetchData();
		}, [fetchData])
	);

	const handleDrop = useCallback(async (wordId: number, categoryId: number) => {
		const targetTableMap: Record<number, string> = {
			1: 'x',
			2: 'y',
			3: 'z'
		};
		const targetTable = targetTableMap[categoryId];

		try {
			const response = await fetchWithRetry(`/api/v1/user-words/classify`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					wordId: wordId,
					targetTable: targetTable
				}),
			});
			const result = await response.json();
			if (!response.ok) {
				throw new Error(result.error || "移动失败");
			}
		} catch (error) {
			console.error("Failed to move word:", error);
			return; // 失败时不更新状态
		}

		setAllWords(prev => prev.filter(w => w.id !== wordId));

		// 重新获取分类数量
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
			console.error("Failed to fetch category counts:", error);
		}
	}, [table]);

	const handleWordPress = (word: Word) => {
		router.push('/word-detail', { 
			word: JSON.stringify({
				id: word.id,
				word: word.word,
				phonetic: word.phonetic || '',
				meaning: word.meaning,
				example: word.example || '',
				example_translation: word.example_translation || '',
				image_url: word.image_url || ''
			}),
			table: table
		});
	};

	return (
		<Screen>
			<View style={styles.container}>
				<View style={styles.header}>
					<TouchableOpacity onPress={() => router.back()}>
						<Text style={styles.backText}>back</Text>
					</TouchableOpacity>
					<Text style={styles.title}>词汇预览</Text>
					<TouchableOpacity onPress={() => router.push('/calendar')}>
							<FontAwesome6 name="calendar-days" size={22} color="#333333" />
						</TouchableOpacity>
				</View>

				<View style={styles.centerContainer}>
					<View style={styles.content}>
						{error ? (
							<View style={styles.emptyContainer}>
								<Text style={styles.errorText}>加载失败: {error}</Text>
								<Text style={styles.errorSubText}>API: {API_BASE_URL}</Text>
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
												onPress={() => handleWordPress(word)}
											/>
												))}
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
							{[1, 2, 3].map((id) => {
								const targetTable = id === 1 ? 'x' : id === 2 ? 'y' : 'z';
								return (
									<TouchableOpacity
										key={id}
										style={styles.categoryItem}
										onPress={() => router.push('/word-list', { table: targetTable })}
									>
										<View style={[styles.categoryCard, { backgroundColor: categoryColors[id - 1] }]}>
											<Text style={styles.categoryName}>{categoryNames[id - 1]}</Text>
											<Text style={styles.categoryCount}>
												({id === 1 ? categoryCounts.x : id === 2 ? categoryCounts.y : categoryCounts.z})
											</Text>
										</View>
									</TouchableOpacity>
								);
							})}
						</View>
						<Text style={styles.instructionText}>拖动单词到上方分类区域</Text>
					</View>
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
	backText: {
		fontSize: 14,
		color: '#000000',
	},
	title: {
		fontSize: 16,
		color: '#333333',
		fontWeight: '600',
	},
	placeholder: {
		width: 50,
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
	errorSubText: {
		fontSize: 12,
		color: '#999999',
	},
	debugContainer: {
		marginTop: 12,
		padding: 10,
		backgroundColor: '#FFFDE7',
		borderRadius: 6,
	},
	debugText: {
		fontSize: 10,
		color: '#666666',
		fontFamily: 'monospace',
	},
});
