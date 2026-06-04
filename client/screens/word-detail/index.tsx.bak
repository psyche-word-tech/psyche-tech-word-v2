import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Image, Modal } from 'react-native';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Audio } from 'expo-av';
import Slider from '@react-native-community/slider';
import { API_BASE_URL } from '@/utils/apiConfig';

interface Word {
	id: number;
	word: string;
	phonetic: string;
	meaning: string;
	example?: string;
	example_translation?: string;
	example_image_url?: string;
}

interface Comment {
	id: number;
	word_id: number;
	word_text: string;
	user_name: string;
	content: string;
	created_at: string;
}

interface GrammarIssue {
	message: string;
	shortMessage: string;
	replacements: string[];
}

interface GrammarResult {
	success: boolean;
	text: string;
	totalIssues: number;
	isCorrect: boolean;
	issues: GrammarIssue[];
}

export default function WordDetailPage() {
	const router = useSafeRouter();
	const params = useSafeSearchParams<{ word: string; table?: string }>();
	
	const [word, setWord] = useState<Word>(() => {
		if (params.word) {
			return JSON.parse(params.word);
		}
		return { id: 0, word: '', phonetic: '', meaning: '' };
	});
	const [currentIndex, setCurrentIndex] = useState(0);
	const [wordsList, setWordsList] = useState<Word[]>([]);
	const [isPlaying, setIsPlaying] = useState(false);
	const [familiarity, setFamiliarity] = useState(50);
	const [categoryCounts, setCategoryCounts] = useState({ x: 0, y: 0, z: 0 });

	// 评论相关状态
	const [comments, setComments] = useState<Comment[]>([]);
	const [commentText, setCommentText] = useState('');
	const [isLoadingComments, setIsLoadingComments] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// 语法检测相关状态
	const [isCheckingGrammar, setIsCheckingGrammar] = useState(false);
	const [grammarResult, setGrammarResult] = useState<GrammarResult | null>(null);
	const [showResultModal, setShowResultModal] = useState(false);

	const sourceTable = params.table || 'words_b';
	const isInitialized = useRef(false);
	const soundRef = useRef<Audio.Sound | null>(null);

	// 获取分类数量
	const fetchCategoryCounts = useCallback(async () => {
		try {
			const [xRes, yRes, zRes] = await Promise.all([
				fetch(`${API_BASE_URL}/api/v1/user-words/category/words_x/count`),
				fetch(`${API_BASE_URL}/api/v1/user-words/category/words_y/count`),
				fetch(`${API_BASE_URL}/api/v1/user-words/category/words_z/count`),
			]);
			const [xData, yData, zData] = await Promise.all([xRes.json(), yRes.json(), zRes.json()]);
			setCategoryCounts({
				x: xData.count || 0,
				y: yData.count || 0,
				z: zData.count || 0,
			});
		} catch (error) {
			console.error('Failed to fetch category counts:', error);
		}
	}, []);

	// 页面加载时获取单词列表
	useFocusEffect(
		useCallback(() => {
			const fetchWordsList = async () => {
				try {
					/**
					 * 服务端文件：server/src/routes/wordbooks.ts
					 * 接口：GET /api/v1/wordbooks/:table
					 */
					const response = await fetch(`${API_BASE_URL}/api/v1/wordbooks/${sourceTable}`);
					const data = await response.json();
					if (Array.isArray(data) && data.length > 0 && !isInitialized.current) {
						setWordsList(data);
						isInitialized.current = true;
					}
				} catch (error) {
					console.error('Failed to fetch words:', error);
				}
			};
			fetchWordsList();
		}, [sourceTable])
	);

	// 获取评论列表
	const fetchComments = useCallback(async (wordId: number) => {
		if (!wordId) return;
		setIsLoadingComments(true);
		try {
			/**
			 * 服务端文件：server/src/routes/comments.ts
			 * 接口：GET /api/v1/comments/:wordId
			 */
			const response = await fetch(`${API_BASE_URL}/api/v1/comments/${wordId}`);
			const data = await response.json();
			setComments(Array.isArray(data) ? data : []);
		} catch (error) {
			console.error('Failed to fetch comments:', error);
			setComments([]);
		} finally {
			setIsLoadingComments(false);
		}
	}, []);

	// 语法检测函数
	const checkGrammar = useCallback(async () => {
		if (!commentText.trim()) {
			Alert.alert('提示', '请输入句子');
			return;
		}

		setIsCheckingGrammar(true);
		try {
			/**
			 * 服务端文件：server/src/routes/grammar-check.ts
			 * 接口：POST /api/v1/grammar-check
			 * Body参数：text: string, language?: string
			 */
			const response = await fetch(`${API_BASE_URL}/api/v1/grammar-check`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					text: commentText.trim(),
					language: 'en-US'
				})
			});

			const result = await response.json();
			
			if (!response.ok) {
				throw new Error(result.error || '检测失败');
			}

			// 语法正确时直接发布，不弹窗
			if (result.isCorrect) {
				// 直接发布
				setIsSubmitting(true);
				try {
					const publishResponse = await fetch(`${API_BASE_URL}/api/v1/comments`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							wordId: word.id,
							wordText: word.word,
							userName: '用户',
							content: commentText.trim()
						})
					});
					
					if (!publishResponse.ok) throw new Error('提交失败');
					
					setCommentText('');
					fetchComments(word.id);
					Alert.alert('成功', '笔记已发布');
				} catch (error) {
					console.error('Failed to submit comment:', error);
					Alert.alert('错误', '发布失败');
				} finally {
					setIsSubmitting(false);
				}
			} else {
				// 有错误时显示弹窗
				setGrammarResult(result);
				setShowResultModal(true);
			}
		} catch (error: any) {
			console.error('Grammar check error:', error);
			Alert.alert('错误', error.message || '语法检测失败，请稍后重试');
		} finally {
			setIsCheckingGrammar(false);
		}
	}, [commentText]);

	// 发布评论
	const submitComment = useCallback(async () => {
		if (!commentText.trim() || !word.id) {
			return;
		}
		
		setIsSubmitting(true);
		try {
			/**
			 * 服务端文件：server/src/routes/comments.ts
			 * 接口：POST /api/v1/comments
			 * Body参数：wordId: number, wordText: string, userName: string, content: string
			 */
			const response = await fetch(`${API_BASE_URL}/api/v1/comments`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					wordId: word.id,
					wordText: word.word,
					userName: '用户',
					content: commentText.trim()
				})
			});
			
			if (!response.ok) throw new Error('提交失败');
			
			setCommentText('');
			setShowResultModal(false);
			setGrammarResult(null);
			fetchComments(word.id);
			Alert.alert('成功', '笔记已发布');
		} catch (error) {
			console.error('Failed to submit comment:', error);
			Alert.alert('错误', '发布失败');
		} finally {
			setIsSubmitting(false);
		}
	}, [commentText, word.id, word.word, fetchComments]);

	// 取消发布
	const cancelPublish = useCallback(() => {
		setShowResultModal(false);
		setGrammarResult(null);
	});

	// 当单词变化时获取评论
	useEffect(() => {
		if (word.id) {
			fetchComments(word.id);
		}
	}, [word.id, fetchComments]);

	// 清理音频资源
	useEffect(() => {
		return () => {
			if (soundRef.current) {
				soundRef.current.unloadAsync();
			}
		};
	}, []);

	// 发音功能
	const playPronunciation = async () => {
		try {
			if (soundRef.current) {
				await soundRef.current.unloadAsync();
			}
			const audioUrl = `https://dict.youdao.com/dictvoice?audio=${word.word}&type=1`;
			const { sound } = await Audio.Sound.createAsync(
				{ uri: audioUrl },
				{ shouldPlay: true }
			);
			soundRef.current = sound;
			setIsPlaying(true);
			sound.setOnPlaybackStatusUpdate((status) => {
				if (status.isLoaded && status.didJustFinish) {
					setIsPlaying(false);
				}
			});
		} catch (error) {
			console.error('Failed to play pronunciation:', error);
		}
	};

	// 切换单词
	const switchWord = async (direction: 'prev' | 'next') => {
		const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
		if (newIndex >= 0 && newIndex < wordsList.length) {
			setCurrentIndex(newIndex);
			setWord(wordsList[newIndex]);
			setCommentText('');
		}
	};

	// 处理单词状态变化 - 移动单词到对应分类
	const handleStatusChange = async (table: string, status: string) => {
		try {
			/**
			 * 服务端文件：server/src/routes/user-words.ts
			 * 接口：POST /api/v1/user-words/move
			 * Body参数：wordId: number, targetTable: string
			 */
			const response = await fetch(`${API_BASE_URL}/api/v1/user-words/move`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					wordId: word.id,
					targetTable: table
				})
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || '移动失败');
			}

			setCurrentCategory(table);
				
			// 从目标分类加载单词
			const listResponse = await fetch(`${API_BASE_URL}/api/v1/user-words/category/${table}`);
			const data = await listResponse.json();
				
			if (Array.isArray(data) && data.length > 0) {
				setWordsList(data);
				setCurrentIndex(0);
				setWord(data[0]);
				setCommentText('');
			} else {
				setWordsList([]);
				setWord({ id: 0, word: '', phonetic: '', meaning: '' });
			}

			Alert.alert('成功', `单词已移动到"${status}"分类，页面切换到 ${status} 列表`);
			// 更新分类数量
			fetchCategoryCounts();
			// 页面已切换到目标分类列表（上面已加载）
		} catch (error) {
			console.error('Failed to move word:', error);
			Alert.alert('错误', '操作失败');
		}
	};

	return (
		<Screen>
			<View style={styles.container}>
				{/* Header */}
				<View style={styles.header}>
					<TouchableOpacity onPress={() => router.back()}>
						<Text style={styles.backText}>← 返回</Text>
					</TouchableOpacity>
					<Text style={styles.headerTitle}>每日单词</Text>
					<View style={styles.placeholder} />
				</View>

				{/* Content */}
				<ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
					{/* Word Section */}
					<View style={styles.wordSection}>
						<View style={styles.wordRow}>
							<Text style={styles.wordText}>{word.word}</Text>
							<TouchableOpacity 
								style={styles.speakerIcon}
								onPress={playPronunciation}
								disabled={isPlaying}
							>
								<Ionicons 
									name={isPlaying ? "volume-high" : "volume-medium-outline"} 
									size={28} 
									color="#4F46E5" 
								/>
							</TouchableOpacity>
						</View>
						<Text style={styles.phoneticText}>{word.phonetic}</Text>
					</View>


					{/* Meaning */}
					<View style={styles.section}>
						<Text style={styles.sectionLabel}>词义</Text>
						<Text style={styles.meaningText}>{word.meaning}</Text>
					</View>

					{/* Example */}
					{word.example && (
						<View style={styles.section}>
							<View style={styles.divider} />
							<Text style={[styles.sectionLabel, { marginTop: 16 }]}>例句</Text>
							<View style={styles.exampleRow}>
								<Text style={styles.exampleText}>{word.example}</Text>
							</View>
							{word.example_translation && (
								<Text style={styles.exampleTranslation}>{word.example_translation}</Text>
							)}
							{word.example_image_url && (
								<View style={styles.exampleImageContainer}>
									<Image 
										source={{ uri: word.example_image_url }} 
										style={styles.exampleImage}
										resizeMode="cover"
									/>
								</View>
							)}
						</View>
					)}

					{/* Status Buttons */}
					<View style={styles.statusSection}>
						<TouchableOpacity style={[styles.statusButton, styles.knownButton]} onPress={() => handleStatusChange('words_x', '已会')}>
							<Text style={styles.statusText}>已会({categoryCounts.x})</Text>
						</TouchableOpacity>
						<TouchableOpacity style={[styles.statusButton, styles.vagueButton]} onPress={() => handleStatusChange('words_y', '模糊')}>
							<Text style={styles.statusText}>模糊({categoryCounts.y})</Text>
						</TouchableOpacity>
						<TouchableOpacity style={[styles.statusButton, styles.unknownButton]} onPress={() => handleStatusChange('words_z', '不会')}>
							<Text style={styles.statusText}>不会({categoryCounts.z})</Text>
						</TouchableOpacity>
					</View>

					{/* Familiarity Slider */}
					<View style={styles.sliderSection}>
						<Text style={styles.sliderLabel}>熟悉度：{familiarity}%</Text>
						<View style={styles.sliderLabels}>
							<Text style={styles.sliderMinText}>最不熟悉</Text>
							<Text style={styles.sliderMaxText}>最熟悉</Text>
						</View>
						<Slider
							style={styles.slider}
							minimumValue={0}
							maximumValue={100}
							value={familiarity}
							onValueChange={(value) => setFamiliarity(Math.round(value))}
							minimumTrackTintColor="#4CAF50"
							maximumTrackTintColor="#E0E0E0"
							thumbTintColor="#4CAF50"
						/>
					</View>

					{/* Comments Section */}
					<View style={styles.commentsSection}>
						<Text style={styles.commentsLabel}>写作&笔记 ({comments.length})</Text>
						
						{/* 句子输入框 */}
						<View style={styles.commentInputContainer}>
							<TextInput
								style={styles.commentInput}
								placeholder="写下你的句子..."
								placeholderTextColor="#999"
								value={commentText}
								onChangeText={setCommentText}
								multiline
								maxLength={500}
							/>
							<TouchableOpacity 
								style={[styles.submitButton, isCheckingGrammar && styles.submitButtonDisabled]} 
								onPress={checkGrammar}
								disabled={isCheckingGrammar}
							>
								{isCheckingGrammar ? (
									<ActivityIndicator size="small" color="#FFF" />
								) : (
									<Text style={styles.submitButtonText}>语法检测</Text>
								)}
							</TouchableOpacity>
						</View>
						
						{/* 评论列表 */}
						{isLoadingComments ? (
							<ActivityIndicator size="small" color="#4F46E5" style={styles.commentsLoading} />
						) : comments.length === 0 ? (
							<Text style={styles.noComments}>暂无笔记，来写点什么吧</Text>
						) : (
							<ScrollView style={styles.commentsList} showsVerticalScrollIndicator={false}>
								{comments.map((comment) => (
									<View key={comment.id} style={styles.commentItem}>
										<View style={styles.commentHeader}>
											<Text style={styles.commentUserName}>{comment.user_name}</Text>
											<Text style={styles.commentDate}>
												{new Date(comment.created_at).toLocaleDateString('zh-CN')}
											</Text>
										</View>
										<Text style={styles.commentContent}>{comment.content}</Text>
									</View>
								))}
							</ScrollView>
						)}
					</View>
				</ScrollView>

				{/* 语法检测结果弹窗 */}
				<Modal
					visible={showResultModal}
					transparent
					animationType="slide"
					onRequestClose={cancelPublish}
				>
					<View style={styles.modalOverlay}>
						<View style={styles.modalContent}>
							{/* 弹窗标题 */}
							<View style={styles.modalHeader}>
								<Text style={styles.modalTitle}>语法检测结果</Text>
								<TouchableOpacity onPress={cancelPublish}>
									<Ionicons name="close" size={24} color="#666" />
								</TouchableOpacity>
							</View>

							{/* 检测结果内容 */}
							<ScrollView style={styles.resultScrollView}>
								{/* 原句 */}
								<View style={styles.resultSection}>
									<Text style={styles.resultLabel}>你的句子</Text>
									<Text style={styles.originalText}>{grammarResult?.text}</Text>
								</View>

								{/* 状态 */}
								<View style={styles.resultSection}>
									{grammarResult?.isCorrect ? (
										<View style={styles.statusCorrect}>
											<Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
											<Text style={styles.statusCorrectText}>语法正确，没有问题！</Text>
										</View>
									) : (
										<View style={styles.statusIncorrect}>
											<Ionicons name="alert-circle" size={24} color="#FF9800" />
											<Text style={styles.statusIncorrectText}>
												发现 {grammarResult?.totalIssues} 个问题
											</Text>
										</View>
									)}
								</View>

								{/* 问题列表 */}
								{grammarResult?.issues && grammarResult.issues.length > 0 && (
									<View style={styles.resultSection}>
										<Text style={styles.resultLabel}>问题详情</Text>
										{grammarResult.issues.map((issue: any, index: number) => (
											<View key={index} style={styles.issueItem}>
												<View style={styles.issueTitleRow}>
													<Text style={styles.issueTitle}>{issue.title}</Text>
												</View>
												<Text style={styles.issueMessage}>{issue.message}</Text>
												{issue.replacements.length > 0 && (
													<View style={styles.replacementContainer}>
														<Text style={styles.replacementLabel}>建议修正：</Text>
														{issue.replacements.map((rep: any, repIndex: number) => (
															<Text key={repIndex} style={styles.replacementText}>
																• {typeof rep === 'string' ? rep : rep.value}
															</Text>
														))}
													</View>
												)}
											</View>
										))}
									</View>
								)}
							</ScrollView>

							{/* 操作按钮 */}
							<View style={styles.modalFooter}>
								<TouchableOpacity 
									style={[styles.modalButton, styles.cancelButton]} 
									onPress={cancelPublish}
								>
									<Text style={styles.cancelButtonText}>取消发布</Text>
								</TouchableOpacity>
								<TouchableOpacity 
									style={[styles.modalButton, styles.publishButton]} 
									onPress={submitComment}
									disabled={isSubmitting}
								>
									{isSubmitting ? (
										<ActivityIndicator size="small" color="#FFF" />
									) : (
										<Text style={styles.publishButtonText}>发布</Text>
									)}
								</TouchableOpacity>
							</View>
						</View>
					</View>
				</Modal>
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
		backgroundColor: '#F5F5F5',
	},
	backText: {
		fontSize: 14,
		color: '#666666',
		fontFamily: 'serif',
	},
	headerTitle: {
		fontSize: 16,
		color: '#333333',
		fontFamily: 'serif',
		fontWeight: '600',
	},
	placeholder: {
		width: 50,
	},
	content: {
		flex: 1,
	},
	wordSection: {
		alignItems: 'center',
		paddingVertical: 40,
		backgroundColor: '#FAFAFA',
	},
	wordRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	wordText: {
		fontSize: 36,
		fontWeight: '700',
		color: '#333333',
		fontFamily: 'Times New Roman',
		textAlign: 'center',
	},
	speakerIcon: {
		padding: 8,
	},
	phoneticText: {
		fontSize: 18,
		color: '#666666',
		fontFamily: 'Times New Roman',
		marginTop: 8,
	},
	navSection: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 12,
		paddingHorizontal: 20,
		backgroundColor: '#FFFFFF',
		borderBottomWidth: 1,
		borderBottomColor: '#EEEEEE',
	},
	navButton: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: 8,
	},
	navButtonDisabled: {
		opacity: 0.5,
	},
	navText: {
		fontSize: 14,
		color: '#4F46E5',
		fontFamily: 'serif',
	},
	navTextDisabled: {
		color: '#CCC',
	},
	navIndex: {
		fontSize: 14,
		color: '#666',
		fontFamily: 'serif',
	},
	section: {
		paddingHorizontal: 20,
		paddingVertical: 16,
	},
	sectionLabel: {
		fontSize: 14,
		fontWeight: '600',
		color: '#333333',
		fontFamily: 'serif',
		marginBottom: 8,
	},
	meaningText: {
		fontSize: 14,
		color: '#333333',
		fontFamily: 'serif',
		lineHeight: 22,
	},
	divider: {
		height: 1,
		backgroundColor: '#EEEEEE',
	},
	exampleRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	exampleText: {
		fontSize: 14,
		color: '#333333',
		fontFamily: 'Times New Roman',
		fontStyle: 'italic',
		flex: 1,
	},
	exampleTranslation: {
		fontSize: 13,
		color: '#666666',
		fontFamily: 'serif',
		marginTop: 8,
		paddingLeft: 4,
	},
	exampleImageContainer: {
		marginTop: 12,
		borderRadius: 12,
		overflow: 'hidden',
		backgroundColor: '#F5F5F5',
	},
	exampleImage: {
		width: '100%',
		height: 200,
	},
	statusSection: {
		flexDirection: 'row',
		justifyContent: 'space-around',
		paddingVertical: 20,
		paddingHorizontal: 20,
	},
	statusButton: {
		paddingHorizontal: 20,
		paddingVertical: 12,
		borderRadius: 8,
		minWidth: 90,
		alignItems: 'center',
	},
	knownButton: {
		backgroundColor: '#4CAF50',
	},
	vagueButton: {
		backgroundColor: '#FF9800',
	},
	unknownButton: {
		backgroundColor: '#F44336',
	},
	statusText: {
		fontSize: 14,
		fontWeight: '600',
		color: '#FFFFFF',
		fontFamily: 'serif',
	},
	sliderSection: {
		paddingHorizontal: 20,
		paddingVertical: 16,
	},
	sliderLabel: {
		fontSize: 14,
		fontWeight: '600',
		color: '#333333',
		fontFamily: 'serif',
		marginBottom: 8,
	},
	sliderLabels: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 4,
	},
	sliderMinText: {
		fontSize: 12,
		color: '#999999',
		fontFamily: 'serif',
	},
	sliderMaxText: {
		fontSize: 12,
		color: '#999999',
		fontFamily: 'serif',
	},
	slider: {
		width: '100%',
		height: 40,
	},
	commentsSection: {
		paddingHorizontal: 20,
		paddingVertical: 16,
	},
	commentsLabel: {
		fontSize: 14,
		fontWeight: '600',
		color: '#333333',
		fontFamily: 'serif',
		marginBottom: 12,
	},
	commentInputContainer: {
		backgroundColor: '#F5F5F5',
		borderRadius: 8,
		padding: 12,
		marginBottom: 16,
	},
	commentInput: {
		fontSize: 14,
		color: '#333333',
		fontFamily: 'serif',
		minHeight: 60,
		textAlignVertical: 'top',
	},
	submitButton: {
		backgroundColor: '#4F46E5',
		borderRadius: 6,
		paddingVertical: 10,
		paddingHorizontal: 20,
		alignSelf: 'flex-end',
		marginTop: 10,
	},
	submitButtonDisabled: {
		backgroundColor: '#A5A5A5',
	},
	submitButtonText: {
		color: '#FFF',
		fontSize: 14,
		fontWeight: '600',
		fontFamily: 'serif',
	},
	commentsLoading: {
		marginVertical: 20,
	},
	noComments: {
		fontSize: 14,
		color: '#999',
		fontFamily: 'serif',
		textAlign: 'center',
		marginVertical: 20,
	},
	commentsList: {
		maxHeight: 300,
	},
	commentItem: {
		backgroundColor: '#F9F9F9',
		borderRadius: 8,
		padding: 12,
		marginBottom: 12,
	},
	commentHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 6,
	},
	commentUserName: {
		fontSize: 13,
		fontWeight: '600',
		color: '#4F46E5',
		fontFamily: 'serif',
	},
	commentDate: {
		fontSize: 12,
		color: '#999',
		fontFamily: 'serif',
	},
	commentContent: {
		fontSize: 14,
		color: '#333',
		fontFamily: 'serif',
		lineHeight: 20,
	},
	// 弹窗样式
	modalOverlay: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		justifyContent: 'flex-end',
	},
	modalContent: {
		backgroundColor: '#FFFFFF',
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
		maxHeight: '80%',
	},
	modalHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: 20,
		borderBottomWidth: 1,
		borderBottomColor: '#EEEEEE',
	},
	modalTitle: {
		fontSize: 18,
		fontWeight: '600',
		color: '#333',
		fontFamily: 'serif',
	},
	resultScrollView: {
		maxHeight: 400,
		padding: 20,
	},
	resultSection: {
		marginBottom: 20,
	},
	resultLabel: {
		fontSize: 14,
		fontWeight: '600',
		color: '#666',
		fontFamily: 'serif',
		marginBottom: 8,
	},
	originalText: {
		fontSize: 16,
		color: '#333',
		fontFamily: 'Times New Roman',
		fontStyle: 'italic',
		lineHeight: 24,
		backgroundColor: '#F5F5F5',
		padding: 12,
		borderRadius: 8,
	},
	statusCorrect: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#E8F5E9',
		padding: 16,
		borderRadius: 8,
		gap: 10,
	},
	statusCorrectText: {
		fontSize: 16,
		color: '#4CAF50',
		fontWeight: '600',
		fontFamily: 'serif',
	},
	statusIncorrect: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#FFF3E0',
		padding: 16,
		borderRadius: 8,
		gap: 10,
	},
	statusIncorrectText: {
		fontSize: 16,
		color: '#FF9800',
		fontWeight: '600',
		fontFamily: 'serif',
	},
	issueItem: {
		backgroundColor: '#FFF3E0',
		padding: 12,
		borderRadius: 8,
		marginBottom: 10,
		borderLeftWidth: 4,
		borderLeftColor: '#FF9800',
	},
	issueTitleRow: {
		marginBottom: 8,
	},
	issueTitle: {
		fontSize: 16,
		fontWeight: '600',
		color: '#E65100',
		fontFamily: 'serif',
	},
	issueMessage: {
		fontSize: 14,
		color: '#333',
		fontFamily: 'serif',
		lineHeight: 20,
	},
	issueShortMessage: {
		fontSize: 13,
		color: '#FF9800',
		fontFamily: 'serif',
		marginTop: 4,
	},
	replacementContainer: {
		marginTop: 8,
		paddingTop: 8,
		borderTopWidth: 1,
		borderTopColor: '#EEE',
	},
	replacementLabel: {
		fontSize: 13,
		color: '#666',
		fontFamily: 'serif',
		marginBottom: 4,
	},
	replacementText: {
		fontSize: 14,
		color: '#4CAF50',
		fontFamily: 'serif',
		marginLeft: 8,
	},
	modalFooter: {
		flexDirection: 'row',
		padding: 20,
		gap: 12,
		borderTopWidth: 1,
		borderTopColor: '#EEEEEE',
	},
	modalButton: {
		flex: 1,
		paddingVertical: 14,
		borderRadius: 8,
		alignItems: 'center',
	},
	cancelButton: {
		backgroundColor: '#F5F5F5',
	},
	cancelButtonText: {
		fontSize: 16,
		fontWeight: '600',
		color: '#666',
		fontFamily: 'serif',
	},
	publishButton: {
		backgroundColor: '#4F46E5',
	},
	publishButtonText: {
		fontSize: 16,
		fontWeight: '600',
		color: '#FFF',
		fontFamily: 'serif',
	},
});
