import { View, Text, TextInput, TouchableOpacity, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useState } from 'react';

export default function SearchScreen() {
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ imageUri?: string }>();
  const imageUri = params.imageUri || '';
  const [query, setQuery] = useState('');

  return (
    <Screen>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <TextInput
            style={styles.searchInput}
            placeholder="搜索单词..."
            placeholderTextColor="#999"
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={styles.content}>
          {/* Show selected image if available */}
          {imageUri.length > 0 && (
            <View style={styles.imageSection}>
              <Text style={styles.sectionTitle}>已选择图片</Text>
              <Image source={{ uri: imageUri }} style={styles.selectedImage} resizeMode="contain" />
              <TouchableOpacity style={styles.retakeButton} onPress={() => router.back()}>
                <Ionicons name="refresh" size={18} color="#666" />
                <Text style={styles.retakeText}>重新选择</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Search Results Placeholder */}
          <View style={styles.resultsPlaceholder}>
            <Ionicons name="search-outline" size={48} color="#DDD" />
            <Text style={styles.hintText}>
              {imageUri ? '图片已加载，输入关键词搜索' : '输入单词或拍照搜索'}
            </Text>
          </View>
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#333',
  },
  content: {
    flex: 1,
  },
  imageSection: {
    padding: 16,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  selectedImage: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
  },
  retakeText: {
    fontSize: 14,
    color: '#666',
  },
  resultsPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  hintText: {
    fontSize: 16,
    color: '#999',
  },
};
