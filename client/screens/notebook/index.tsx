import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { API_BASE_URL } from '@/utils/apiConfig';
import { fetchWithRetry } from '@/utils/apiClient';

interface NotebookWord {
  id: number;
  word: string;
  meaning: string;
  phonetic?: string;
  created_at: string;
}

export default function NotebookPage() {
  const router = useSafeRouter();
  const [words, setWords] = useState<NotebookWord[]>([]);
  const [newWord, setNewWord] = useState('');
  const [newMeaning, setNewMeaning] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const fetchWords = async () => {
    try {
      const response = await fetchWithRetry(`/api/v1/words/notebook`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setWords(data);
      }
    } catch (error) {
      console.error('Failed to fetch notebook words:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchWords();
    }, [])
  );

  const handleAddWord = async () => {
    if (!newWord.trim() || !newMeaning.trim()) {
      Alert.alert('提示', '请填写单词和释义');
      return;
    }

    try {
      const response = await fetchWithRetry(`/api/v1/words/notebook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: newWord.trim(),
          meaning: newMeaning.trim()
        }),
      });

      if (response.ok) {
        setNewWord('');
        setNewMeaning('');
        setIsAdding(false);
        fetchWords();
        Alert.alert('成功', '单词已添加到生词本');
      }
    } catch (error) {
      console.error('Failed to add word:', error);
      Alert.alert('错误', '添加失败，请重试');
    }
  };

  const handleDeleteWord = async (id: number) => {
    Alert.alert(
      '确认删除',
      '确定要删除这个单词吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetchWithRetry(`/api/v1/words/notebook/${id}`, {
                method: 'DELETE',
              });
              fetchWords();
            } catch (error) {
              console.error('Failed to delete word:', error);
            }
          },
        },
      ]
    );
  };

  return (
    <Screen>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>生词本</Text>
          <TouchableOpacity onPress={() => setIsAdding(true)}>
            <Text style={styles.addText}>+ 添加</Text>
          </TouchableOpacity>
        </View>

        {/* Add Word Form */}
        {isAdding && (
          <View style={styles.addForm}>
            <TextInput
              style={styles.input}
              placeholder="单词"
              placeholderTextColor="#999999"
              value={newWord}
              onChangeText={setNewWord}
            />
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="释义"
              placeholderTextColor="#999999"
              value={newMeaning}
              onChangeText={setNewMeaning}
              multiline
            />
            <View style={styles.formButtons}>
              <TouchableOpacity
                style={[styles.formButton, styles.cancelButton]}
                onPress={() => {
                  setIsAdding(false);
                  setNewWord('');
                  setNewMeaning('');
                }}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formButton, styles.saveButton]}
                onPress={handleAddWord}
              >
                <Text style={styles.saveButtonText}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Word List */}
        <ScrollView style={styles.listContainer}>
          {words.length > 0 ? (
            words.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.wordItem}
                onLongPress={() => handleDeleteWord(item.id)}
              >
                <View style={styles.wordHeader}>
                  <Text style={styles.wordText}>{item.word}</Text>
                  {item.phonetic && (
                    <Text style={styles.phoneticText}>{item.phonetic}</Text>
                  )}
                </View>
                <Text style={styles.meaningText}>{item.meaning}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>生词本为空</Text>
              <Text style={styles.emptyHint}>点击右上角&quot;添加&quot;记录新单词</Text>
            </View>
          )}
        </ScrollView>
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
  title: {
    fontSize: 16,
    color: '#333333',
    fontFamily: 'serif',
    fontWeight: '600',
  },
  addText: {
    fontSize: 14,
    color: '#4CAF50',
    fontFamily: 'serif',
    fontWeight: '600',
  },
  addForm: {
    padding: 16,
    backgroundColor: '#FAFAFA',

  },
  input: {
    backgroundColor: '#FFFFFF',

    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333333',
    fontFamily: 'serif',
    marginBottom: 12,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  formButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',

  },
  cancelButtonText: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'serif',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  saveButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'serif',
  },
  listContainer: {
    flex: 1,
    padding: 16,
  },
  wordItem: {
    backgroundColor: '#FAFAFA',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,

  },
  wordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wordText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    fontFamily: 'serif',
  },
  phoneticText: {
    fontSize: 12,
    color: '#999999',
    fontFamily: 'Times New Roman',
  },
  meaningText: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'serif',
    marginTop: 4,
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
});
