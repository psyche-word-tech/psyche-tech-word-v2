import { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, Alert, Pressable } from 'react-native';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { useApiConfig } from '@/contexts/ApiConfigContext';
import { fetchWithRetry } from '@/utils/apiClient';

interface WordBook {
  id: number;
  name: string;
}

// 全局缓存，避免返回时重复加载
let globalBooksCache: WordBook[] | null = null;

export default function MyVocabularyPage() {
  const router = useSafeRouter();
  const { apiBaseUrl, isConfigLoaded } = useApiConfig();
  const [boughtBooks, setBoughtBooks] = useState<WordBook[]>(globalBooksCache || []);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [isLoading, setIsLoading] = useState(!globalBooksCache);
  const [errorMsg, setErrorMsg] = useState('');
  const isRefreshingRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      const loadBooks = async () => {
        if (!isConfigLoaded) return;
        if (isRefreshingRef.current) return;
        
        // 如果有缓存数据，先显示缓存，后台静默刷新
        const hasCache = globalBooksCache !== null && globalBooksCache.length > 0;
        if (!hasCache) {
          setIsLoading(true);
        }
        setErrorMsg('');
        isRefreshingRef.current = true;
        
        try {
          const response = await fetchWithRetry(`/api/v1/wordbooks`);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          
          const allBooks = await response.json();
          
          if (!Array.isArray(allBooks)) {
            throw new Error('API返回数据格式错误');
          }
          
          // 只保留已购买的（根据 API 返回的 purchased 字段）
          const purchasedBooks = allBooks
            .filter((book: any) => book.purchased === true)
            .map((book: any) => ({ id: book.id, name: book.name }));
          
          globalBooksCache = purchasedBooks;
          setBoughtBooks(purchasedBooks);
        } catch (error: any) {
          console.error('[MyVocabulary] 加载失败:', error);
          // 有缓存时不显示错误，静默失败
          if (!hasCache) {
            const rawMsg = error?.message || '';
            if (rawMsg.includes('aborted') || rawMsg.includes('timeout') || rawMsg.includes('Abort')) {
              setErrorMsg('请求超时，请稍后重试');
            } else {
              setErrorMsg(rawMsg || '加载失败，请检查网络连接');
            }
          }
        } finally {
          setIsLoading(false);
          isRefreshingRef.current = false;
        }
      };
      
      loadBooks();
    }, [apiBaseUrl, isConfigLoaded])
  );

  const handleLearnPress = (book: WordBook) => {
    // 考研/四级/六级未解锁
    if (book.id === 2 || book.id === 3 || book.id === 4) {
      setAlertMessage('您未解锁本词汇书');
      setAlertVisible(true);
      return;
    }

    const tableMap: Record<number, string> = {
      1: 'a',
      2: 'b',
      3: 'c',
      4: 'd'
    };
    const table = tableMap[book.id] || 'b';
    router.push('/word-preview', { table });
  };

  if (!isConfigLoaded) {
    return (
      <Screen>
        <View style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/')}>
            <Text style={styles.backText}>← back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>我的词汇书</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Word Books Grid */}
        <View style={styles.gridContainer}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4CAF50" />
              <Text style={styles.loadingText}>加载中...</Text>
            </View>
          ) : errorMsg ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>加载失败</Text>
              <Text style={styles.errorHint}>({errorMsg})</Text>
            </View>
          ) : boughtBooks.length > 0 ? (
            boughtBooks.map((book: WordBook, index: number) => (
              <View key={book.id} style={styles.bookItem}>
                <View style={styles.tagContainer}>
                  {book.name.split('').map((char, i) => (
                    <Text key={i} style={styles.tagText}>{char}</Text>
                  ))}
                </View>
                
                <Pressable style={styles.learnButton} onPress={() => handleLearnPress(book)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <View style={styles.learnTextContainer}>
                    <Text style={styles.learnText}>开</Text>
                    <Text style={styles.learnText}>始</Text>
                    <Text style={styles.learnText}>学</Text>
                    <Text style={styles.learnText}>习</Text>
                  </View>
                </Pressable>
                
                {index === 1 && (
                  <TouchableOpacity style={styles.oldSchoolButton} onPress={() => router.push('/tree-diagram')}>
                    <Text style={styles.oldSchoolText}>old-school</Text>
                  </TouchableOpacity>
                )}

              </View>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>暂无词汇书</Text>
              <Text style={styles.emptyHint}>请先购买词汇书</Text>
            </View>
          )}
        </View>

        {/* Alert Modal */}
        <Modal
          visible={alertVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setAlertVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.alertBox}>
              <Text style={styles.alertText}>{alertMessage}</Text>
              <TouchableOpacity 
                style={styles.alertButton}
                onPress={() => setAlertVisible(false)}
              >
                <Text style={styles.alertButtonText}>返回</Text>
              </TouchableOpacity>
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
    backgroundColor: '#D8D8D8',
  },
  backText: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'serif',
  },
  title: {
    fontSize: 16,
    color: '#666666',
    fontFamily: 'serif',
    fontWeight: '600',
  },
  placeholder: {
    width: 50,
  },
  oldSchoolButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 200,
    alignSelf: 'center',
  },
  oldSchoolText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'serif',
    fontWeight: '600',
  },
  gridContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingTop: 60,
    paddingHorizontal: 16,
    gap: 8,
  },
  bookItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 2,
  },
  tagContainer: {
    backgroundColor: '#EBEBEB',
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 12,
    alignItems: 'center',
    width: '100%',
  },
  tagText: {
    fontSize: 12,
    color: '#666666',
    fontFamily: 'serif',
  },
  learnButton: {
    backgroundColor: '#EBEBEB',
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 6,
    width: '100%',
    alignItems: 'center',
  },
  learnTextContainer: {
    alignItems: 'center',
  },
  learnText: {
    fontSize: 12,
    color: '#666666',
    fontFamily: 'serif',
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
    fontFamily: 'serif',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 12,
    color: '#CCCCCC',
    fontFamily: 'serif',
  },
  errorHint: {
    fontSize: 10,
    color: '#F44336',
    fontFamily: 'monospace',
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#999999',
    fontFamily: 'serif',
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertBox: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  alertText: {
    fontSize: 14,
    color: '#333333',
    fontFamily: 'serif',
    marginBottom: 16,
    textAlign: 'center',
  },
  alertButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 4,
  },
  alertButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'serif',
  },
});
