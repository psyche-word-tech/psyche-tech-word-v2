import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { getApiBaseUrl } from '@/utils/apiConfig';

export default function SubmitHomeworkScreen() {
  const router = useSafeRouter();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!selectedImage) {
      Alert.alert('提示', '请先选择或拍摄图片');
      return;
    }

    setUploading(true);
    try {
      // 将图片转换为 base64
      const response = await fetch(selectedImage);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // 上传到服务器
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64,
          type: 'student',
        }),
      });

      const data = await res.json();
      if (data.success) {
        Alert.alert('成功', '作业已提交，等待教师批改', [
          { text: '确定', onPress: () => router.replace('/') },
        ]);
      } else {
        Alert.alert('失败', data.message || '提交失败');
      }
    } catch (error) {
      Alert.alert('错误', '提交失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        {/* 顶部导航栏 */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>提交作业</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {selectedImage ? (
            <View style={styles.imageContainer}>
              <Image source={{ uri: selectedImage }} style={styles.previewImage} resizeMode="contain" />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => setSelectedImage(null)}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle" size={28} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.uploadArea}>
              <TouchableOpacity style={styles.uploadButton} onPress={handleTakePhoto} activeOpacity={0.7}>
                <Ionicons name="camera-outline" size={48} color="#9CA3AF" />
                <Text style={styles.uploadButtonText}>拍照</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.uploadButton} onPress={handlePickImage} activeOpacity={0.7}>
                <Ionicons name="images-outline" size={48} color="#9CA3AF" />
                <Text style={styles.uploadButtonText}>从相册选择</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.hintText}>支持 JPG、PNG 格式</Text>
        </ScrollView>

        {selectedImage && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.submitButton, uploading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={uploading}
              activeOpacity={0.7}
            >
              {uploading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>提交作业</Text>
              )}
            </TouchableOpacity>
          </View>
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
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    alignItems: 'center',
  },
  uploadArea: {
    width: '100%',
    marginTop: 40,
    gap: 20,
  },
  uploadButton: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#E5E7EB',
    gap: 12,
  },
  uploadButtonText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  hintText: {
    marginTop: 16,
    fontSize: 14,
    color: '#9CA3AF',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
