import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { API_BASE_URL } from '@/utils/apiConfig';
import { fetchWithRetry } from '@/utils/apiClient';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

// 词汇书ID到数据库表的映射
// id 对应 vocabulary 页面的词汇书ID
const BOOK_TABLE_MAP: Record<number, { sourceTable: string; name: string }> = {
  1: { sourceTable: 'a', name: '高中词汇' },
  2: { sourceTable: 'a', name: '四级词汇' },
  3: { sourceTable: 'a', name: '六级词汇' },
  4: { sourceTable: 'a', name: '考研词汇' },
};

// 默认词汇书列表（当没有传入books时使用）
const DEFAULT_BOOKS = [
  { id: 1, name: '高中词汇', price: 0 },
  { id: 2, name: '四级词汇', price: 0 },
  { id: 3, name: '六级词汇', price: 0 },
  { id: 4, name: '考研词汇', price: 0 },
];

interface Book {
  id: number;
  name: string;
  price: number;
}

export default function PurchasePage() {
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ books?: string }>();
  const [isLoading, setIsLoading] = useState(false);
  
  // 获取词汇书列表
  const books: Book[] = params.books ? JSON.parse(params.books) : DEFAULT_BOOKS;
  
  // 选中的词汇书 - 初始化时选中所有传入的书籍
  const [selectedBooks, setSelectedBooks] = useState<Set<number>>(() => {
    if (params.books) {
      const parsedBooks: Book[] = JSON.parse(params.books);
      return new Set(parsedBooks.map(b => b.id));
    }
    return new Set();
  });
  
  // 切换选择状态
  const toggleBook = (bookId: number) => {
    setSelectedBooks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bookId)) {
        newSet.delete(bookId);
      } else {
        newSet.add(bookId);
      }
      return newSet;
    });
  };
  
  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedBooks.size === books.length) {
      setSelectedBooks(new Set());
    } else {
      setSelectedBooks(new Set(books.map(b => b.id)));
    }
  };

  const handleConfirm = async () => {
    if (selectedBooks.size === 0) {
      Alert.alert('提示', '请至少选择一本词汇书');
      return;
    }

    setIsLoading(true);

    try {
      // 逐本购买
      for (const bookId of selectedBooks) {
        const bookConfig = BOOK_TABLE_MAP[bookId];
        const response = await fetchWithRetry(`/api/v1/wordbooks/copy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceTable: bookConfig.sourceTable,
            targetTable: 'b',
            bookId: bookId,
          }),
        });

        const result = await response.json();
        if (!result.success) {
          Alert.alert('失败', `购买"${bookConfig.name}"失败：${result.error || '请重试'}`);
          setIsLoading(false);
          return;
        }
      }
      
      // 全部购买成功
      Alert.alert('成功', `已成功购买${selectedBooks.size}本词汇书`, [
        { text: '确定', onPress: () => router.replace('/my-vocabulary') }
      ]);
    } catch (error) {
      console.error('Purchase error:', error);
      Alert.alert('错误', '网络错误，请检查网络连接');
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <Screen>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← 返回</Text>
          </TouchableOpacity>
          <Text style={styles.title}>确认购买</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Dialog */}
        <View style={styles.dialogContainer}>
          <View style={styles.dialog}>
            {/* Empty space */}
            <View style={styles.emptySpace} />
            
            {/* Main content */}
            <View style={styles.content}>
              {/* 词汇书选择列表 */}
              <Text style={styles.sectionTitle}>选择词汇书</Text>
              
              {/* 全选按钮 */}
              <TouchableOpacity style={styles.selectAllButton} onPress={toggleSelectAll}>
                <Text style={styles.selectAllText}>
                  {selectedBooks.size === books.length ? '取消全选' : '全选'}
                </Text>
              </TouchableOpacity>
              
              {/* 词汇书列表 */}
              <View style={styles.bookList}>
                {books.map((book) => (
                  <TouchableOpacity
                    key={book.id}
                    style={styles.bookItem}
                    onPress={() => toggleBook(book.id)}
                  >
                    <View style={[
                      styles.checkbox,
                      selectedBooks.has(book.id) && styles.checkboxChecked
                    ]}>
                      {selectedBooks.has(book.id) && (
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      )}
                    </View>
                    <Text style={styles.bookName}>{book.name}</Text>
                    <Text style={styles.bookPrice}>
                      {book.price === 0 ? '免费' : `¥${book.price}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              {/* 已选数量提示 */}
              <Text style={styles.selectedHint}>
                已选择 {selectedBooks.size} 本词汇书
              </Text>
              
              {/* Buttons */}
              <View style={styles.buttonRow}>
                <TouchableOpacity 
                  style={[styles.button, styles.confirmButton]} 
                  onPress={handleConfirm}
                  disabled={isLoading || selectedBooks.size === 0}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.buttonText, styles.confirmButtonText]}>确认购买</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.button, styles.cancelButton]} 
                  onPress={handleCancel}
                  disabled={isLoading}
                >
                  <Text style={styles.buttonText}>取消</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            {/* Notice */}
            <View style={styles.noticeBar}>
              <Text style={styles.noticeText}>点击确认后将开始复制词汇</Text>
            </View>
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
    fontFamily: 'serif',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'serif',
  },
  placeholder: {
    width: 50,
  },
  dialogContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialog: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',

  },
  emptySpace: {
    height: 80,
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  mainText: {
    fontSize: 16,
    color: '#000000',
    textAlign: 'center',
    fontFamily: 'serif',
    marginBottom: 16,
  },
  subText: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    fontFamily: 'serif',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 20,
  },
  button: {
    paddingHorizontal: 30,
    paddingVertical: 12,

    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  confirmButton: {
    backgroundColor: '#4CAF50',

  },
  confirmButtonText: {
    color: '#FFFFFF',
  },
  cancelButton: {
    backgroundColor: '#F0F0F0',
  },
  buttonText: {
    fontSize: 14,
    color: '#000000',
    fontFamily: 'serif',
  },
  noticeBar: {
    backgroundColor: '#E5E5E5',
    padding: 12,
    alignItems: 'center',
  },
  noticeText: {
    fontSize: 12,
    color: '#666666',
    fontFamily: 'serif',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    fontFamily: 'serif',
    marginBottom: 16,
    textAlign: 'center',
  },
  selectAllButton: {
    alignSelf: 'flex-end',
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#4F46E5',
    borderRadius: 4,
  },
  selectAllText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'serif',
  },
  bookList: {
    width: '100%',
  },
  bookItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    marginBottom: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#CCCCCC',
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  bookName: {
    flex: 1,
    fontSize: 15,
    color: '#333333',
    fontFamily: 'serif',
  },
  bookPrice: {
    fontSize: 14,
    color: '#4CAF50',
    fontFamily: 'serif',
    fontWeight: '600',
  },
  selectedHint: {
    fontSize: 13,
    color: '#666666',
    fontFamily: 'serif',
    marginTop: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
});
