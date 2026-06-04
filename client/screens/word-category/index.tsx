import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { useFocusEffect } from 'expo-router';
import { API_BASE_URL } from '@/utils/apiConfig';
import { fetchWithRetry } from '@/utils/apiClient';

interface Word {
	id: number;
	word: string;
	phonetic: string;
	meaning: string;
	example?: string;
	example_translation?: string;
	image_url?: string;
}

export default function WordCategoryPage() {
	const router = useSafeRouter();
	const params = useSafeSearchParams<{ table: string; name: string }>();
	const [words, setWords] = useState<Word[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const tableName = params.table || 'x';
	const categoryName = params.name || '已会';

	// 获取分类单词
	const fetchWords = useCallback(async () => {
		setIsLoading(true);
		try {
			const response = await fetchWithRetry(`/api/v1/user-words/category/${tableName}`);
			const data = await response.json();
			if (Array.isArray(data)) {
				setWords(data);
			}
		} catch (error) {
			console.error('Failed to fetch words:', error);
		} finally {
			setIsLoading(false);
		}
	}, [tableName]);

	// 页面加载时获取数据
	useFocusEffect(
		useCallback(() => {
			fetchWords();
		}, [fetchWords])
	);

	// 跳转到单词详情
	const goToWordDetail = (word: Word) => {
		router.push('/word-detail', { word: JSON.stringify(word), table: tableName });
	};

	// 渲染单词卡片
	const renderWordCard = ({ item }: { item: Word }) => (
		<TouchableOpacity style={styles.wordCard} onPress={() => goToWordDetail(item)}>
			<Text style={styles.wordText}>{item.word}</Text>
			<Text style={styles.phoneticText}>{item.phonetic}</Text>
			<Text style={styles.meaningText} numberOfLines={2}>{item.meaning}</Text>
		</TouchableOpacity>
	);

	const getButtonColor = () => {
		switch (tableName) {
			case 'words_x': return '#4CAF50';
			case 'words_y': return '#FF9800';
			case 'words_z': return '#F44336';
			case 'x': return '#4CAF50';
			case 'y': return '#FF9800';
			case 'z': return '#F44336';
			default: return '#4F46E5';
		}
	};

	return (
		<Screen>
			<View style={styles.container}>
				{/* Header */}
				<View style={styles.header}>
					<TouchableOpacity onPress={() => router.back()}>
						<Text style={styles.backText}>← Back</Text>
					</TouchableOpacity>
					<Text style={styles.headerTitle}>{categoryName}</Text>
					<View style={styles.countBadge}>
						<Text style={[styles.countText, { color: getButtonColor() }]}>{words.length}</Text>
					</View>
				</View>

				{/* Word List */}
				{isLoading ? (
					<View style={styles.loadingContainer}>
						<ActivityIndicator size="large" color={getButtonColor()} />
					</View>
				) : (
					<FlatList
						data={words}
						renderItem={renderWordCard}
						keyExtractor={(item) => item.id.toString()}
						contentContainerStyle={styles.listContainer}
						showsVerticalScrollIndicator={false}
						ListEmptyComponent={
							<View style={styles.emptyContainer}>
								<Text style={styles.emptyText}>暂无{categoryName}的单词</Text>
							</View>
						}
					/>
				)}
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
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#E5E5E5',
	},
	backText: {
		fontSize: 16,
		color: '#4F46E5',
	},
	headerTitle: {
		fontSize: 18,
		fontWeight: '600',
		color: '#333333',
	},
	countBadge: {
		backgroundColor: '#F5F5F5',
		borderRadius: 12,
		paddingHorizontal: 12,
		paddingVertical: 4,
	},
	countText: {
		fontSize: 16,
		fontWeight: '700',
	},
	loadingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	listContainer: {
		padding: 16,
	},
	wordCard: {
		backgroundColor: '#F5F5F5',
		borderRadius: 12,
		padding: 16,
		marginBottom: 12,
	},
	wordText: {
		fontSize: 20,
		fontWeight: '700',
		color: '#333333',
		marginBottom: 4,
	},
	phoneticText: {
		fontSize: 14,
		color: '#666666',
		marginBottom: 8,
	},
	meaningText: {
		fontSize: 14,
		color: '#999999',
		lineHeight: 20,
	},
	emptyContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingVertical: 60,
	},
	emptyText: {
		fontSize: 16,
		color: '#999999',
	},
});
