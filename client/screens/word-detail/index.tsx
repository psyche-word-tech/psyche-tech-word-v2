/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Image, Modal, Dimensions } from 'react-native';
import { Video } from 'expo-av';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Audio } from 'expo-av';

import * as FileSystem from 'expo-file-system/legacy';
import Slider from '@react-native-community/slider';
import { API_BASE_URL } from '@/utils/apiConfig';
import { fetchWithRetry } from '@/utils/apiClient';
import { createFormDataFile } from '@/utils/createFormDataFile';

interface Word {
	id: number;
	word: string;
	phonetic: string;
	meaning: string;
	example?: string;
	example_translation?: string;
	translation?: string;
	example_image_url?: string;
	image_url?: string;
	example_audio_url?: string;
	noun_phrase?: string;
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

// 跨平台 alert 辅助函数（Web 端 Alert.alert 可能不显示）
function showAlert(title: string, message: string) {
	if (typeof window !== 'undefined' && window.alert) {
		window.alert(`${title}\n${message}`);
	} else {
		Alert.alert(title, message);
	}
}

interface GrammarResult {
	success: boolean;
	text: string;
	totalIssues: number;
	isCorrect: boolean;
	issues: GrammarIssue[];
}

interface EvaluationResult {
	success: boolean;
	transcription: string;
	accuracy: number;
	fluency: number;
	pronunciation: number;
	overall: number;
	feedback: string;
	wordCorrect: boolean;
}

export default function WordDetailPage() {
	const router = useSafeRouter();
	const params = useSafeSearchParams<{ word: string; table?: string; from?: string; index?: string }>();
	
	const [word, setWord] = useState<Word>(() => {
		if (params.word) {
			return JSON.parse(params.word);
		}
		return { id: 0, word: '', phonetic: '', meaning: '' };
	});
	const [currentIndex, setCurrentIndex] = useState(0);
	const [wordsList, setWordsList] = useState<Word[]>([]);
	const [filteredWordsList, setFilteredWordsList] = useState<Word[]>([]);
	const [isPlaying, setIsPlaying] = useState(false);
	const [isAudioPlaying, setIsAudioPlaying] = useState(false);
	const [familiarity, setFamiliarity] = useState(50);
	const [categoryCounts, setCategoryCounts] = useState({ x: 0, y: 0, z: 0 });
	const [mindmapCounts, setMindmapCounts] = useState({ x: 0, y: 0, z: 0 });
	const soundRef = useRef<Audio.Sound | null>(null);
	const fetchCategoryCountsRef = useRef<() => void>(() => { /* noop */ });
	const fetchMindmapCountsRef = useRef<() => void>(() => { /* noop */ });

	// 评论相关状态
	const [comments, setComments] = useState<Comment[]>([]);
	const [commentText, setCommentText] = useState('');
	const [isLoadingComments, setIsLoadingComments] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// 语法检测相关状态
	const [isCheckingGrammar, setIsCheckingGrammar] = useState(false);
	const [grammarResult, setGrammarResult] = useState<GrammarResult | null>(null);
	const [showResultModal, setShowResultModal] = useState(false);

	// 录音评分相关状态
	const [isRecording, setIsRecording] = useState(false);
	const [isEvaluating, setIsEvaluating] = useState(false);
	const [evalStep, setEvalStep] = useState('');
	const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
	const [showEvalModal, setShowEvalModal] = useState(false);
	const recordingRef = useRef<Audio.Recording | null>(null);
	const [recordingVolume, setRecordingVolume] = useState<number[]>(new Array(20).fill(0));
	const meteringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const recordedChunksRef = useRef<Blob[]>([]);

	// 双击按钮显示分类单词弹窗
	const [categoryModalVisible, setCategoryModalVisible] = useState(false);
	const [categoryModalTitle, setCategoryModalTitle] = useState('');
	const [categoryModalWords, setCategoryModalWords] = useState<Word[]>([]);
	const [categoryModalLoading, setCategoryModalLoading] = useState(false);
	const lastDropTapRef = useRef<{ table: string; time: number } | null>(null);
	const dropTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const sourceTable = params.table || 'b';
	const isInitialized = useRef(false);

	// 移动单词到目标分类，并自动显示当前表中的下一个单词
	const handleDrop = useCallback(async (targetTable: string, status: string) => {
		console.log('handleDrop called:', targetTable, status);
		console.log('Current word:', word.id, word.word, 'sourceTable:', sourceTable);
		if (!word.id || word.id === 0) {
			console.log('Word ID is invalid, skipping');
			return;
		}

		try {
			if (params.from === 'mindmap') {
				// 按钮传入的是 words_x/y/z，后端 move-mindmap 只接受 x1/y1/z1
				const targetMap: Record<string, string> = {
					words_x: 'x1',
					words_y: 'y1',
					words_z: 'z1',
				};
				const mindmapTarget = targetMap[targetTable];
				if (!mindmapTarget) {
					Alert.alert('错误', '无效的目标分类');
					return;
				}

				// 使用过滤后的列表找到当前索引和下一个单词
				let nextWordData: Word | null = null;
				let currentFilteredIndex = -1;
				try {
					// 重新获取最新的过滤列表
					const [listRes, x1Res, y1Res, z1Res] = await Promise.all([
						fetch(`${API_BASE_URL}/api/v1/wordbooks/${params.table || '111'}`),
						fetch(`${API_BASE_URL}/api/v1/wordbooks/x1`),
						fetch(`${API_BASE_URL}/api/v1/wordbooks/y1`),
						fetch(`${API_BASE_URL}/api/v1/wordbooks/z1`),
					]);
					const [listData, x1Data, y1Data, z1Data] = await Promise.all([
						listRes.json(), x1Res.json(), y1Res.json(), z1Res.json(),
					]);
					if (Array.isArray(listData)) {
						const classifiedWords = new Set([
							...(Array.isArray(x1Data) ? x1Data.map((w: any) => w.word) : []),
							...(Array.isArray(y1Data) ? y1Data.map((w: any) => w.word) : []),
							...(Array.isArray(z1Data) ? z1Data.map((w: any) => w.word) : []),
						]);
						const filtered = listData.filter((w: Word) => !classifiedWords.has(w.word));
						setFilteredWordsList(filtered);
						currentFilteredIndex = filtered.findIndex((w: Word) => w.word === word.word);
						console.log('Mindmap filtered list length:', filtered.length, 'currentIndex:', currentFilteredIndex);
						if (currentFilteredIndex >= 0 && currentFilteredIndex < filtered.length - 1) {
							nextWordData = filtered[currentFilteredIndex + 1];
							console.log('Next filtered word found:', nextWordData?.word);
						}
					}
				} catch (e) {
					console.log('获取过滤列表失败:', e);
				}

				/**
				 * 服务端文件：server/src/routes/user-words.ts
				 * 接口：POST /api/v1/user-words/move-mindmap
				 * Body参数：targetTable: string, word: string
				 */
				const response = await fetch(`${API_BASE_URL}/api/v1/user-words/move-mindmap`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						sourceTable: '111',
						targetTable: mindmapTarget,
						word: word.word,
					})
				});

				const result = await response.json();
				console.log('Move mindmap API response:', response.status, result);

				if (!response.ok) {
					throw new Error(result.error || '移动失败');
				}

				// 刷新计数
				fetchMindmapCountsRef.current();

				// 显示成功提示，不自动跳转页面
				Alert.alert('成功', `已将单词"${word.word}"标记为"${status}"`);
				return;
			}

			/**
			 * 服务端文件：server/src/routes/wordbooks.ts
			 * 接口：POST /api/v1/wordbooks/move
			 * Body参数：sourceTable: string, targetTable: string, wordId: number
			 */
			const response = await fetch(`${API_BASE_URL}/api/v1/wordbooks/move`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sourceTable: sourceTable,
					targetTable: targetTable,
					wordId: word.id,
				})
			});

			const result = await response.json();
			console.log('Move API response:', response.status, result);

			if (!response.ok) {
				throw new Error(result.error || '移动失败');
			}

			// 更新分类数量
			fetchCategoryCountsRef.current();

			// 从当前源表重新加载单词列表，并自动显示下一个单词
			const listResponse = await fetch(`${API_BASE_URL}/api/v1/user-words/category/${sourceTable}`);
			const data = await listResponse.json();
			if (Array.isArray(data) && data.length > 0) {
				// 移除已移动的单词，显示下一个
				const nextWords = data.filter((w: Word) => w.id !== word.id);
				setWordsList(nextWords);
				if (nextWords.length > 0) {
					setCurrentIndex(0);
					setWord(nextWords[0]);
				} else {
					setWord({ id: 0, word: '', phonetic: '', meaning: '' });
				}
				setCommentText('');
			} else {
				setWordsList([]);
				setWord({ id: 0, word: '', phonetic: '', meaning: '' });
			}
		} catch (error) {
			console.error('Failed to move word:', error);
			Alert.alert('错误', '操作失败');
		}
	}, [word.id, word.word, sourceTable]);

	// 获取分类数量
	const fetchCategoryCounts = useCallback(async () => {
		try {
			const [xRes, yRes, zRes] = await Promise.all([
				fetch(`${API_BASE_URL}/api/v1/user-words/category/x/count`),
				fetch(`${API_BASE_URL}/api/v1/user-words/category/y/count`),
				fetch(`${API_BASE_URL}/api/v1/user-words/category/z/count`),
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

	const fetchMindmapCounts = useCallback(async () => {
		try {
			const [xRes, yRes, zRes] = await Promise.all([
				fetch(`${API_BASE_URL}/api/v1/user-words/category/x1/count`),
				fetch(`${API_BASE_URL}/api/v1/user-words/category/y1/count`),
				fetch(`${API_BASE_URL}/api/v1/user-words/category/z1/count`),
			]);
			const [xData, yData, zData] = await Promise.all([xRes.json(), yRes.json(), zRes.json()]);
			setMindmapCounts({
				x: xData.count || 0,
				y: yData.count || 0,
				z: zData.count || 0,
			});
		} catch (error) {
			console.error('Failed to fetch mindmap counts:', error);
		}
	}, []);

	// 将 fetchCategoryCounts 和 fetchMindmapCounts 赋值给 ref
	useEffect(() => {
		fetchCategoryCountsRef.current = fetchCategoryCounts;
	}, [fetchCategoryCounts]);

	useEffect(() => {
		fetchMindmapCountsRef.current = fetchMindmapCounts;
	}, [fetchMindmapCounts]);

	// 双击底部按钮：显示分类单词列表弹窗
	const handleDropDoubleTap = useCallback(async (targetTable: string, label: string) => {
		// 映射到实际表名
		let tableName = targetTable;
		if (params.from === 'mindmap') {
			const map: Record<string, string> = { words_x: 'x1', words_y: 'y1', words_z: 'z1' };
			tableName = map[targetTable] || targetTable;
		}

		setCategoryModalVisible(true);
		setCategoryModalTitle(label);
		setCategoryModalLoading(true);
		setCategoryModalWords([]);

		try {
			const response = await fetch(`${API_BASE_URL}/api/v1/wordbooks/${tableName}`);
			const data = await response.json();
			if (Array.isArray(data)) {
				setCategoryModalWords(data);
			} else {
				setCategoryModalWords([]);
			}
		} catch (error) {
			console.error('Failed to fetch category words:', error);
			setCategoryModalWords([]);
		} finally {
			setCategoryModalLoading(false);
		}
	}, [params.from]);

	// 使用 ref 存储处理函数，避免 handleDropZonePress 因依赖变化而频繁重建导致点击失效
	const handleDropRef = useRef(handleDrop);
	const handleDropDoubleTapRef = useRef(handleDropDoubleTap);
	useEffect(() => { handleDropRef.current = handleDrop; }, [handleDrop]);
	useEffect(() => { handleDropDoubleTapRef.current = handleDropDoubleTap; }, [handleDropDoubleTap]);

	const handleDropZonePress = useCallback((targetTable: string, status: string) => {
		const now = Date.now();
		if (lastDropTapRef.current && lastDropTapRef.current.table === targetTable && now - lastDropTapRef.current.time < 300) {
			// 双击
			if (dropTapTimerRef.current) {
				clearTimeout(dropTapTimerRef.current);
				dropTapTimerRef.current = null;
			}
			lastDropTapRef.current = null;
			handleDropDoubleTapRef.current(targetTable, status);
		} else {
			// 单击（延迟执行）
			if (dropTapTimerRef.current) {
				clearTimeout(dropTapTimerRef.current);
			}
			dropTapTimerRef.current = setTimeout(() => {
				handleDropRef.current(targetTable, status);
				dropTapTimerRef.current = null;
			}, 300);
			lastDropTapRef.current = { table: targetTable, time: now };
		}
	}, []);

	// 页面加载时获取单词列表和分类数量
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

					// 导图模式：获取过滤后的列表（111中但不在x1/y1/z1中的单词）
					if (params.from === 'mindmap' && sourceTable === '111') {
						const [x1Res, y1Res, z1Res] = await Promise.all([
							fetch(`${API_BASE_URL}/api/v1/wordbooks/x1`),
							fetch(`${API_BASE_URL}/api/v1/wordbooks/y1`),
							fetch(`${API_BASE_URL}/api/v1/wordbooks/z1`),
						]);
						const [x1Data, y1Data, z1Data] = await Promise.all([
							x1Res.json(), y1Res.json(), z1Res.json(),
						]);
						const classifiedWords = new Set([
							...(Array.isArray(x1Data) ? x1Data.map((w: any) => w.word) : []),
							...(Array.isArray(y1Data) ? y1Data.map((w: any) => w.word) : []),
							...(Array.isArray(z1Data) ? z1Data.map((w: any) => w.word) : []),
						]);
						const filtered = data.filter((w: Word) => !classifiedWords.has(w.word));
						setFilteredWordsList(filtered);
						console.log(`[WordDetail Filtered] total=${data.length}, classified=${classifiedWords.size}, filtered=${filtered.length}`);
					} else {
						setFilteredWordsList(data);
					}
				} catch (error) {
					console.error('Failed to fetch words:', error);
				}
			};
			fetchWordsList();
			fetchCategoryCountsRef.current();
			fetchMindmapCountsRef.current();
		}, [sourceTable])
	);

	// 导图模式：如果从"进入导图单词"按钮进入（没有传入具体单词），自动切换到第一个未分类的单词
	useEffect(() => {
		if (params.from !== 'mindmap' || filteredWordsList.length === 0 || !word.word) return;
		// 如果用户点击了具体单词进入，始终显示该单词，不自动切换
		if (params.word) return;
		const exists = filteredWordsList.find((w) => w.word === word.word);
		if (!exists) {
			console.log(`[WordDetail AutoSwitch] ${word.word} already classified, switching to ${filteredWordsList[0].word}`);
			setWord(filteredWordsList[0]);
			setCurrentIndex(0);
		}
	}, [filteredWordsList, word.word, params.from, params.word]);

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
			showAlert('提示', '请输入句子');
			return;
		}

		setIsCheckingGrammar(true);
		try {
				/**
			 * 服务端文件：server/src/routes/grammar-check.ts
			 * 接口：POST /api/v1/grammar-check
			 * Body参数：text: string, language?: string
			 */
			const response = await fetchWithRetry(`/api/v1/grammar-check`, {
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
					showAlert('成功', '笔记已发布');
				} catch (error) {
					console.error('Failed to submit comment:', error);
					showAlert('错误', '发布失败');
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
			showAlert('错误', error.message || '语法检测失败，请稍后重试');
		} finally {
			setIsCheckingGrammar(false);
		}
	}, [commentText, word?.id, word?.word]);

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
			showAlert('成功', '笔记已发布');
		} catch (error) {
			console.error('Failed to submit comment:', error);
			showAlert('错误', '发布失败');
		} finally {
			setIsSubmitting(false);
		}
	}, [commentText, word.id, word.word, fetchComments]);

	// 取消发布
	const cancelPublish = useCallback(() => {
		setShowResultModal(false);
		setGrammarResult(null);
	}, []);

	// 当单词变化时获取评论
	useEffect(() => {
		if (!word.id) return;
		setIsLoadingComments(true);
		fetch(`${API_BASE_URL}/api/v1/comments/${word.id}`)
			.then(response => response.json())
			.then(data => {
				setComments(Array.isArray(data) ? data : []);
			})
			.catch(error => {
				console.error('Failed to fetch comments:', error);
				setComments([]);
			})
			.finally(() => {
				setIsLoadingComments(false);
			});
	}, [word.id]);

	// 重新从后端获取完整单词数据，确保包含 example_audio_url
		// 重新从后端获取完整单词数据，确保包含 example_audio_url
		useEffect(() => {
			if (!word.id) return;
			fetch(`${API_BASE_URL}/api/v1/wordbooks/${sourceTable}`)
				.then(response => response.json())
				.then(data => {
					if (Array.isArray(data)) {
						const fullWord = data.find((w: any) => w.id === word.id);
						if (fullWord) {
							// 更新完整单词数据，包括所有字段
							setWord(prev => ({ 
								...prev, 
								...fullWord,
								example_audio_url: fullWord.example_audio_url 
							}));
							console.log("Updated word with full data:", fullWord);
						}
					}
				})
				.catch(error => {
					console.error("Failed to fetch full word data:", error);
				});
		}, [word.id, sourceTable]);

		// gut 单词出现时立即播放切鱼音效
		useEffect(() => {
			if (!word.id) return;

			// 只有 gut 单词才播放音效
			if (word.word !== "gut") return;

			console.log("检测到 gut 单词，播放真实切鱼音效！");

			// 使用真实的音效文件
			const playRealFishSound = async () => {
				try {
					if (soundRef.current) {
						await soundRef.current.unloadAsync();
					}

					setIsAudioPlaying(true);

					await Audio.setAudioModeAsync({
						playsInSilentModeIOS: true,
						staysActiveInBackground: false,
						shouldDuckAndroid: true,
					});

					// 加载本地音效文件
					console.log("正在加载真实切鱼音效...");
					const { sound } = await Audio.Sound.createAsync(
						require("@/assets/fish-cutting-sound.mp3"),
						{ shouldPlay: true, volume: 1.0 },
						(status: any) => {
							console.log("音效播放状态:", status);
							if (status.isLoaded && status.didJustFinish) {
								console.log("真实切鱼音效播放完成！");
								setIsAudioPlaying(false);
							}
							if (status.error) {
								console.error("音效播放错误:", status.error);
								setIsAudioPlaying(false);
							}
						},
						true
					);

					console.log("真实切鱼音效开始播放！");
					soundRef.current = sound;
				} catch (error: any) {
					console.error("真实切鱼音效播放失败:", error);
					setIsAudioPlaying(false);
				}
			};

			// 立即播放
			playRealFishSound();

			return () => {
				if (soundRef.current) {
					soundRef.current.unloadAsync();
				}
			};
		}, [word.id, word.word]);




	// 清理音频资源
	useEffect(() => {
		return () => {
			if (soundRef.current) {
				soundRef.current.unloadAsync();
			}
		};
	}, []);

	// 发音功能：统一走后端 TTS，手机端和电脑端效果一致
	const playPronunciation = async (text?: string) => {
		const playText = text || word?.word || '';
		if (!playText) return;
		setIsPlaying(true);

		if (typeof document !== 'undefined') {
			// Web 端：直接用浏览器 Audio 元素播放后端 URL
			try {
				const audioUrl = `${API_BASE_URL}/api/v1/tts?text=${encodeURIComponent(playText)}`;
				const audio = document.createElement('audio');
				audio.src = audioUrl;
				audio.onended = () => setIsPlaying(false);
				audio.onerror = () => {
					setIsPlaying(false);
					(window as any).alert?.('发音失败: 音频无法加载，请检查网络或稍后重试');
				};
				audio.play().catch(() => {
					setIsPlaying(false);
					(window as any).alert?.('发音失败: 音频播放被阻止或后端未响应');
				});
			} catch {
				setIsPlaying(false);
				(window as any).alert?.('发音失败: 网络请求异常');
			}
		} else {
			// 移动端：下载到本地后播放
			playDownloadedTTS(playText);
		}
	};

	// 下载在线音频并播放（移动端专用）
	const playDownloadedTTS = async (text: string) => {
		try {
			if (soundRef.current) {
				await soundRef.current.unloadAsync();
			}
			await Audio.setAudioModeAsync({
				playsInSilentModeIOS: true,
				staysActiveInBackground: false,
				shouldDuckAndroid: true,
			});
			const encoded = encodeURIComponent(text);
			const response = await fetchWithRetry(`/api/v1/tts?text=${encoded}`);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}
			const arrayBuffer = await response.arrayBuffer();
			const bytes = new Uint8Array(arrayBuffer);
			let binary = '';
			for (let i = 0; i < bytes.byteLength; i++) {
				binary += String.fromCharCode(bytes[i]);
			}
			const base64 = btoa(binary);

			const localUri = (FileSystem as any).cacheDirectory + 'tts.mp3';
			await (FileSystem as any).writeAsStringAsync(localUri, base64, {
				encoding: 'base64',
			});

			const { sound } = await Audio.Sound.createAsync(
				{ uri: localUri },
				{ shouldPlay: true },
				undefined,
				true
			);
			soundRef.current = sound;
			sound.setOnPlaybackStatusUpdate((status) => {
				if (status.isLoaded && status.didJustFinish) {
					setIsPlaying(false);
				}
			});
		} catch (error: any) {
			console.error('Downloaded TTS error:', error);
			setIsPlaying(false);
			Alert.alert('发音提示', `发音失败: ${error?.message || '网络错误'}`);
		}
	};

	// 播放预录制的例句音频，失败时自动 fallback 到 TTS 朗读
	const playExampleAudio = async () => {
		const audioUrl = word.example_audio_url as string;
		if (!audioUrl) {
			// 没有预录制音频，直接用 TTS 朗读例句
			playPronunciation(word.example);
			return;
		}

		// Web端直接用浏览器Audio播放
		if (typeof document !== 'undefined') {
			setIsAudioPlaying(true);
			const audio = document.createElement('audio');
			audio.src = audioUrl;
			audio.onended = () => setIsAudioPlaying(false);
			audio.onerror = () => {
				setIsAudioPlaying(false);
				console.error('Web example audio error, fallback to TTS');
				playPronunciation(word.example);
			};
			audio.play().catch(() => {
				setIsAudioPlaying(false);
				playPronunciation(word.example);
			});
			return;
		}

		try {
			if (soundRef.current) {
				await soundRef.current.unloadAsync();
			}

			setIsAudioPlaying(true);

			await Audio.setAudioModeAsync({
				playsInSilentModeIOS: true,
				staysActiveInBackground: false,
				shouldDuckAndroid: true,
			});

			const { sound } = await Audio.Sound.createAsync(
				{ uri: audioUrl },
				{ shouldPlay: true },
				undefined,
				true
			);

			soundRef.current = sound;
			sound.setOnPlaybackStatusUpdate((status: any) => {
				if (status.isLoaded && status.didJustFinish) {
					setIsAudioPlaying(false);
				}
				if (status.error) {
					setIsAudioPlaying(false);
					playPronunciation(word.example);
				}
			});
		} catch (error: any) {
			console.error("Example audio play error:", error);
			setIsAudioPlaying(false);
			// fallback 到 TTS 朗读例句
			playPronunciation(word.example);
		}
	};



	// 录音评分功能
	const startRecording = async () => {
		try {
			// Web 端使用浏览器 MediaRecorder API
			if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
				const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
				const mediaRecorder = new MediaRecorder(stream);
				mediaRecorderRef.current = mediaRecorder;
				recordedChunksRef.current = [];
				mediaRecorder.ondataavailable = (event) => {
					if (event.data.size > 0) {
						recordedChunksRef.current.push(event.data);
					}
				};
				mediaRecorder.start();
				setIsRecording(true);
				return;
			}

			// 移动端使用 expo-av
			const { status } = await Audio.requestPermissionsAsync();
			if (status !== 'granted') {
				Alert.alert('权限不足', '需要麦克风权限才能录音');
				return;
			}
			await Audio.setAudioModeAsync({
				allowsRecordingIOS: true,
				playsInSilentModeIOS: true,
			});
			// 使用 LOW_QUALITY 预设减小文件大小，加快上传和转换速度
			const { recording } = await Audio.Recording.createAsync(
				Audio.RecordingOptionsPresets.LOW_QUALITY
			);
			recordingRef.current = recording;
			setIsRecording(true);

			// 启动音量监测
			setRecordingVolume(new Array(20).fill(0));
			meteringIntervalRef.current = setInterval(async () => {
				if (recordingRef.current) {
					const status = await recordingRef.current.getStatusAsync();
					if (status.isRecording && status.metering !== undefined) {
						// metering 范围通常是 -160 ~ 0，映射到 0 ~ 1
						const normalized = Math.max(0, Math.min(1, (status.metering + 60) / 60));
						setRecordingVolume(prev => {
							const next = [...prev.slice(1), normalized];
							return next;
						});
					}
				}
			}, 100);
		} catch (error) {
			console.error('Failed to start recording:', error);
			Alert.alert('错误', '无法启动录音');
		}
	};

	const stopRecording = async () => {
		try {
			setIsRecording(false);
			// 清除音量监测定时器
			if (meteringIntervalRef.current) {
				clearInterval(meteringIntervalRef.current);
				meteringIntervalRef.current = null;
			}

			// Web 端：使用 MediaRecorder 上传 Blob
			if (mediaRecorderRef.current) {
				const mediaRecorder = mediaRecorderRef.current;
				mediaRecorder.stop();
				// 等待数据收集完成
				await new Promise<void>((resolve) => {
					mediaRecorder.onstop = () => resolve();
				});

				// 停止所有 track
				if (mediaRecorder.stream) {
					mediaRecorder.stream.getTracks().forEach(track => track.stop());
				}
				mediaRecorderRef.current = null;

				if (!word.example) return;

				setIsEvaluating(true);
				setEvalStep('正在上传音频...');
				const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
				recordedChunksRef.current = [];

				// 上传音频到后端进行评分
				const formData = new FormData();
				formData.append('audio', blob, 'recording.webm');
				formData.append('originalText', word.example);

				setEvalStep('正在识别语音...');
				const response = await fetch(`${API_BASE_URL}/api/v1/speech-eval`, {
					method: 'POST',
					body: formData,
				});

				setEvalStep('正在评分...');
				const result = await response.json();
				if (!response.ok) {
					throw new Error(result.error || '评分失败');
				}

				setEvaluationResult(result);
				setShowEvalModal(true);
				setEvalStep('');
				return;
			}

			// 移动端：使用 expo-av
			if (!recordingRef.current) return;
			await recordingRef.current.stopAndUnloadAsync();
			const uri = recordingRef.current.getURI();
			recordingRef.current = null;

			if (!uri || !word.example) return;

			setIsEvaluating(true);
			setEvalStep('正在上传音频...');

			// 上传音频到后端进行评分
			const formData = new FormData();
			formData.append('audio', createFormDataFile(uri, 'recording.m4a', 'audio/m4a'));
			formData.append('originalText', word.example);

			setEvalStep('正在识别语音...');
			const response = await fetch(`${API_BASE_URL}/api/v1/speech-eval`, {
				method: 'POST',
				body: formData,
			});

			setEvalStep('正在评分...');
			const result = await response.json();
			if (!response.ok) {
				throw new Error(result.error || '评分失败');
			}

			setEvaluationResult(result);
			setShowEvalModal(true);
			setEvalStep('');
		} catch (error: any) {
			console.error('Evaluation error:', error);
			Alert.alert('评分失败', error.message || '无法完成评分，请重试');
		} finally {
			setIsEvaluating(false);
			setEvalStep('');
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

			// 从 words_b 重新加载单词列表（移除已移动的单词）
			const listResponse = await fetch(`${API_BASE_URL}/api/v1/user-words/category/b`);
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

			Alert.alert('成功', `单词已移动到"${status}"分类`, [
				{
					text: '确定',
					onPress: () => {
						fetchCategoryCounts();
						// 返回到词汇预览列表
						router.back();
					}
				}
			]);
		} catch (error) {
			console.error('Failed to move word:', error);
			Alert.alert('错误', '移动失败，请重试');
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
					<Text style={styles.headerTitle}>{params.from === 'mindmap' ? '导图单词' : '每日单词'}</Text>
					<View style={styles.placeholder} />
				</View>

				{/* Content */}
				<ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
					{/* Word Card */}
					<View style={styles.wordCard}>
						<View style={styles.wordRow}>
							<Text style={styles.wordText}>{word.word}</Text>
							<TouchableOpacity 
								style={styles.speakerIcon}
								onPress={() => playPronunciation()}
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

					{/* Noun Phrase */}
					{word.noun_phrase && (
						<View style={styles.section}>
							<Text style={styles.sectionLabel}>名词短语</Text>
							<Text style={styles.nounPhraseText}>{word.noun_phrase}</Text>
						</View>
					)}

					{/* 配图 */}
					{(word.example_image_url || word.image_url) && (
						<View style={styles.section}>
							<View style={styles.divider} />
							<Text style={[styles.sectionLabel, { marginTop: 16 }]}>配图</Text>
							<View style={styles.exampleImageContainer}>
								{(() => {
									const imgUrl = word.example_image_url || word.image_url || '';
									return imgUrl.includes('word-videos') || imgUrl.endsWith('.mp4') ? (
										<Video
											source={{ uri: imgUrl }}
											style={styles.exampleImage}
											shouldPlay={true}
											isLooping={true}
											isMuted={true}
											useNativeControls={false}
										/>
									) : (
										<Image
											source={{ uri: imgUrl }}
											style={styles.exampleImage}
											resizeMode="cover"
										/>
									);
								})()}
							</View>
						</View>
					)}

					{/* Example */}
					{word.example && (
						<View style={styles.section}>
							<View style={styles.divider} />
							<Text style={[styles.sectionLabel, { marginTop: 16 }]}>例句</Text>

							{/* 录音音波 */}
							{isRecording && (
								<View style={styles.waveformContainer}>
									{recordingVolume.map((vol, idx) => (
										<View
											key={idx}
											style={[
												styles.waveformBar,
												{
													height: Math.max(4, vol * 36),
													backgroundColor: vol > 0.5 ? '#EF4444' : '#F87171',
												}
											]}
										/>
									))}
								</View>
							)}
							<View style={styles.exampleRow}>
								<Text style={styles.exampleText}>{word.example}</Text>
								<View style={styles.exampleActions}>
									<TouchableOpacity
										style={styles.exampleSpeakerIcon}
										onPress={() => playPronunciation(word.example)}
										disabled={isPlaying}
									>
										<Ionicons
											name={isPlaying ? "volume-high" : "volume-medium-outline"}
											size={20}
											color="#4F46E5"
										/>
									</TouchableOpacity>
										<TouchableOpacity
											style={styles.exampleSpeakerIcon}
											onPress={playExampleAudio}
											disabled={isAudioPlaying}
										>
											<Ionicons
												name={isAudioPlaying ? "play-circle" : "play-circle-outline"}
												size={20}
												color="#059669"
											/>
										</TouchableOpacity>
									<TouchableOpacity
										style={[
											styles.recordButton,
											isRecording && styles.recordButtonActive
										]}
										onPressIn={startRecording}
										onPressOut={stopRecording}
										disabled={isEvaluating}
									>
										{isEvaluating ? (
											<ActivityIndicator size="small" color="#FFF" />
										) : (
											<Ionicons
												name={isRecording ? "mic" : "mic-outline"}
												size={20}
												color={isRecording ? "#FFF" : "#EF4444"}
											/>
										)}
									</TouchableOpacity>
								</View>
							</View>
								{isEvaluating && evalStep ? (
									<Text style={styles.evalStepText}>{evalStep}</Text>
								) : null}
							{(word.example_translation || word.translation) && (
								<Text style={styles.exampleTranslation}>{word.example_translation || word.translation}</Text>
							)}
						</View>
					)}

					{/* Drop Zones */}
					<View style={styles.dropZonesContainer}>
						<View style={styles.dropZones}>
							<TouchableOpacity
								style={[styles.dropZone, styles.dropZoneX]}
								onPress={() => handleDropZonePress('x', '已会')}
							>
								<Text style={styles.dropZoneText}>已会</Text>
								<Text style={styles.dropZoneCount}>({params.from === 'mindmap' ? mindmapCounts.x : categoryCounts.x})</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[styles.dropZone, styles.dropZoneY]}
								onPress={() => handleDropZonePress('y', '模糊')}
							>
								<Text style={styles.dropZoneText}>模糊</Text>
								<Text style={styles.dropZoneCount}>({params.from === 'mindmap' ? mindmapCounts.y : categoryCounts.y})</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[styles.dropZone, styles.dropZoneZ]}
								onPress={() => handleDropZonePress('z', '不会')}
							>
								<Text style={styles.dropZoneText}>不会</Text>
								<Text style={styles.dropZoneCount}>({params.from === 'mindmap' ? mindmapCounts.z : categoryCounts.z})</Text>
							</TouchableOpacity>
						</View>
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

				{/* 发音评分弹窗 */}
				<Modal
					visible={showEvalModal}
					transparent
					animationType="slide"
					onRequestClose={() => setShowEvalModal(false)}
				>
					<View style={styles.modalOverlay}>
						<View style={styles.modalContent}>
							<View style={styles.modalHeader}>
								<Text style={styles.modalTitle}>发音评分</Text>
								<TouchableOpacity onPress={() => setShowEvalModal(false)}>
									<Ionicons name="close" size={24} color="#666" />
								</TouchableOpacity>
							</View>

							<ScrollView style={styles.resultScrollView}>
								{/* 识别文本 */}
								<View style={styles.resultSection}>
									<Text style={styles.resultLabel}>识别结果</Text>
									<Text style={styles.originalText}>{evaluationResult?.transcription || '-'}</Text>
								</View>

								{/* 总分 */}
								<View style={styles.resultSection}>
									<View style={styles.scoreContainer}>
										<Text style={styles.scoreValue}>{evaluationResult?.overall || 0}</Text>
										<Text style={styles.scoreLabel}>总分</Text>
									</View>
								</View>

								{/* 分项得分 */}
								<View style={styles.resultSection}>
									<Text style={styles.resultLabel}>分项得分</Text>
									<View style={styles.scoreRow}>
										<View style={styles.scoreItem}>
											<Text style={styles.scoreItemValue}>{evaluationResult?.accuracy || 0}</Text>
											<Text style={styles.scoreItemLabel}>准确度</Text>
										</View>
										<View style={styles.scoreItem}>
											<Text style={styles.scoreItemValue}>{evaluationResult?.fluency || 0}</Text>
											<Text style={styles.scoreItemLabel}>流利度</Text>
										</View>
										<View style={styles.scoreItem}>
											<Text style={styles.scoreItemValue}>{evaluationResult?.pronunciation || 0}</Text>
											<Text style={styles.scoreItemLabel}>发音</Text>
										</View>
									</View>
								</View>

								{/* 反馈 */}
								<View style={styles.resultSection}>
									<Text style={styles.resultLabel}>评语</Text>
									<Text style={styles.feedbackText}>{evaluationResult?.feedback || '-'}</Text>
								</View>
							</ScrollView>

							<View style={styles.modalFooter}>
								<TouchableOpacity
									style={[styles.modalButton, styles.publishButton]}
									onPress={() => setShowEvalModal(false)}
								>
									<Text style={styles.publishButtonText}>确定</Text>
								</TouchableOpacity>
							</View>
						</View>
					</View>
				</Modal>

				{/* 分类单词列表弹窗 */}
				<Modal
					visible={categoryModalVisible}
					transparent
					animationType="slide"
					onRequestClose={() => setCategoryModalVisible(false)}
				>
					<View style={styles.modalOverlay}>
						<View style={styles.modalContent}>
							<View style={styles.modalHeader}>
								<Text style={styles.modalTitle}>{categoryModalTitle}</Text>
								<TouchableOpacity onPress={() => setCategoryModalVisible(false)}>
									<Ionicons name="close" size={24} color="#666" />
								</TouchableOpacity>
							</View>

							{categoryModalLoading ? (
								<View style={styles.modalLoading}>
									<ActivityIndicator size="large" color="#4F46E5" />
									<Text style={styles.modalLoadingText}>加载中...</Text>
								</View>
							) : categoryModalWords.length === 0 ? (
								<View style={styles.modalEmpty}>
									<Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
									<Text style={styles.modalEmptyText}>暂无单词</Text>
								</View>
							) : (
								<ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
									<View style={styles.categoryWordsGrid}>
										{categoryModalWords.map((item, idx) => (
											<TouchableOpacity
												key={item.id}
												style={[
													styles.categoryWordCard,
													(idx + 1) % 3 === 0 && styles.categoryWordCardThird,
												]}
												onPress={() => {
													setCategoryModalVisible(false);
													const tableMap: Record<string, string> = { words_x: params.from === 'mindmap' ? 'x1' : 'x', words_y: params.from === 'mindmap' ? 'y1' : 'y', words_z: params.from === 'mindmap' ? 'z1' : 'z' };
													// 根据当前弹窗标题推断表名
													let targetTable = sourceTable;
													if (categoryModalTitle === '已会') targetTable = params.from === 'mindmap' ? 'x1' : 'x';
													else if (categoryModalTitle === '模糊') targetTable = params.from === 'mindmap' ? 'y1' : 'y';
													else if (categoryModalTitle === '不会') targetTable = params.from === 'mindmap' ? 'z1' : 'z';
													router.push('/word-detail', {
														word: JSON.stringify(item),
														table: targetTable,
														from: params.from || '',
													});
												}}
												activeOpacity={0.7}
											>
												<Text style={styles.categoryWordText}>{item.word}</Text>
											</TouchableOpacity>
										))}
									</View>
								</ScrollView>
							)}
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
		justifyContent: 'center',
		gap: 12,
		marginLeft: 40,
	},
	wordText: {
		fontSize: 28,
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
		textAlign: 'center',
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
	nounPhraseText: {
		fontSize: 15,
		color: '#2E7D32',
		fontFamily: 'serif',
		fontWeight: '600',
		lineHeight: 24,
		backgroundColor: '#E8F5E9',
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 8,
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
		flex: 1,
	},
	exampleSpeakerIcon: {
		padding: 8,
		marginLeft: 8,
		backgroundColor: '#EEF2FF',
		borderRadius: 8,
	},
	exampleTranslation: {
		fontSize: 13,
		color: '#666666',
		fontFamily: 'serif',
		marginTop: 8,
		paddingLeft: 4,
	},
	evalStepText: {
		fontSize: 12,
		color: '#059669',
		marginTop: 6,
		textAlign: 'center',
		fontStyle: 'italic',
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
		flex: 1,
		maxHeight: Dimensions.get('window').height * 0.8,
		minHeight: 280,
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
	// 拖拽相关样式
	wordCard: {
		backgroundColor: '#FFFFFF',
		borderRadius: 16,
		padding: 24,
		marginHorizontal: 20,
		marginVertical: 16,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 8,
		elevation: 4,
	},
	wordCardDragging: {
		shadowOpacity: 0.3,
		shadowRadius: 16,
		elevation: 8,
		opacity: 0.9,
	},
	dragHint: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		marginTop: 16,
		paddingTop: 12,
		borderTopWidth: 1,
		borderTopColor: '#F0F0F0',
		gap: 6,
	},
	dragHintText: {
		fontSize: 12,
		color: '#999',
		fontFamily: 'serif',
	},
	dropZonesContainer: {
		paddingHorizontal: 20,
		paddingVertical: 16,
		backgroundColor: '#F8F8F8',
		borderTopWidth: 1,
		borderTopColor: '#E0E0E0',
	},
	dropZoneHint: {
		fontSize: 12,
		color: '#999',
		textAlign: 'center',
		marginBottom: 12,
		fontFamily: 'serif',
	},
	dropZones: {
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	dropZone: {
		flex: 1,
		marginHorizontal: 6,
		paddingVertical: 10,
		borderRadius: 16,
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: 52,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 3 },
		shadowOpacity: 0.15,
		shadowRadius: 6,
		elevation: 4,
	},
	dropZoneX: {
		backgroundColor: '#66BB6A',
	},
	dropZoneY: {
		backgroundColor: '#FFA726',
	},
	dropZoneZ: {
		backgroundColor: '#EF5350',
	},
	dropZoneText: {
		fontSize: 15,
		fontWeight: '600',
		color: '#FFFFFF',
		fontFamily: 'serif',
	},
	dropZoneCount: {
		fontSize: 12,
		color: 'rgba(255,255,255,0.9)',
		marginTop: 4,
		fontFamily: 'serif',
	},
	// 录音按钮样式
	exampleActions: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	recordButton: {
		padding: 8,
		backgroundColor: '#FEE2E2',
		borderRadius: 8,
	},
	recordButtonActive: {
		backgroundColor: '#EF4444',
	},
	// 音波动画样式
	waveformContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		height: 40,
		marginBottom: 8,
		gap: 3,
	},
	waveformBar: {
		width: 4,
		borderRadius: 2,
		backgroundColor: '#EF4444',
	},
	// 评分弹窗样式
	scoreContainer: {
		alignItems: 'center',
		paddingVertical: 16,
		backgroundColor: '#F0FDF4',
		borderRadius: 12,
	},
	scoreValue: {
		fontSize: 48,
		fontWeight: '700',
		color: '#16A34A',
		fontFamily: 'serif',
	},
	scoreLabel: {
		fontSize: 14,
		color: '#666',
		fontFamily: 'serif',
		marginTop: 4,
	},
	scoreRow: {
		flexDirection: 'row',
		justifyContent: 'space-around',
		marginTop: 8,
	},
	scoreItem: {
		alignItems: 'center',
		backgroundColor: '#F5F5F5',
		borderRadius: 8,
		paddingVertical: 12,
		paddingHorizontal: 16,
		flex: 1,
		marginHorizontal: 4,
	},
	scoreItemValue: {
		fontSize: 24,
		fontWeight: '700',
		color: '#4F46E5',
		fontFamily: 'serif',
	},
	scoreItemLabel: {
		fontSize: 12,
		color: '#666',
		fontFamily: 'serif',
		marginTop: 4,
	},
	feedbackText: {
		fontSize: 14,
		color: '#333',
		fontFamily: 'serif',
		lineHeight: 22,
		backgroundColor: '#F5F5F5',
		padding: 12,
		borderRadius: 8,
	},
	// 分类单词弹窗样式
	modalLoading: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingVertical: 60,
	},
	modalLoadingText: {
		marginTop: 16,
		fontSize: 14,
		color: '#999',
		fontFamily: 'serif',
	},
	modalEmpty: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingVertical: 80,
	},
	modalEmptyText: {
		marginTop: 12,
		fontSize: 15,
		color: '#999',
		fontFamily: 'serif',
	},
	modalScroll: {
		flex: 1,
	},
	categoryWordsGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		padding: 12,
	},
	categoryWordCard: {
		width: '31%',
		aspectRatio: 2.5,
		backgroundColor: '#F3F4F6',
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: 10,
		marginRight: '3.5%',
	},
	categoryWordCardThird: {
		marginRight: 0,
	},
	categoryWordText: {
		fontSize: 15,
		fontWeight: '600',
		color: '#1F2937',
		fontFamily: 'serif',
	},
});
