import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useState, useRef } from 'react';
import { getApiBaseUrl } from '@/utils/apiConfig';

export default function ReviewDetailScreen() {
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ id?: string }>();
  const submissionId = params.id || '';

  const [imageUrl, setImageUrl] = useState('');
  const [grade, setGrade] = useState('');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [annotations, setAnnotations] = useState<Array<{ x: number; y: number; type: 'circle' | 'line' }>>([]);
  const [drawMode, setDrawMode] = useState<'none' | 'circle' | 'line'>('none');
  const canvasRef = useRef<any>(null);

  // 模拟加载数据
  useState(() => {
    // 实际应该从 API 获取
    setImageUrl('https://via.placeholder.com/400x600');
  });

  const handleImagePress = (event: any) => {
    if (drawMode === 'none') return;

    const { locationX, locationY } = event.nativeEvent;
    const newAnnotation = {
      x: locationX,
      y: locationY,
      type: drawMode as 'circle' | 'line',
    };
    setAnnotations([...annotations, newAnnotation]);
  };

  const handleSave = async () => {
    if (!grade.trim()) {
      Alert.alert('提示', '请输入分数');
      return;
    }

    setSaving(true);
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/submissions/${submissionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade,
          feedback,
          annotations,
          status: 'graded',
        }),
      });

      const data = await res.json();
      if (data.success) {
        Alert.alert('成功', '批改已保存', [
          { text: '确定', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('失败', data.message || '保存失败');
      }
    } catch (error) {
      Alert.alert('错误', '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const clearAnnotations = () => {
    setAnnotations([]);
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
          <Text style={styles.headerTitle}>批改详情</Text>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.7}
          >
            <Text style={styles.saveButtonText}>{saving ? '保存中...' : '保存'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* 图片区域 */}
          <View style={styles.imageSection}>
            <View style={styles.toolbar}>
              <TouchableOpacity
                style={[styles.toolButton, drawMode === 'circle' && styles.toolButtonActive]}
                onPress={() => setDrawMode(drawMode === 'circle' ? 'none' : 'circle')}
                activeOpacity={0.7}
              >
                <Ionicons name="ellipse-outline" size={20} color={drawMode === 'circle' ? '#3B82F6' : '#6B7280'} />
                <Text style={[styles.toolText, drawMode === 'circle' && styles.toolTextActive]}>画圈</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toolButton, drawMode === 'line' && styles.toolButtonActive]}
                onPress={() => setDrawMode(drawMode === 'line' ? 'none' : 'line')}
                activeOpacity={0.7}
              >
                <Ionicons name="remove-outline" size={20} color={drawMode === 'line' ? '#3B82F6' : '#6B7280'} />
                <Text style={[styles.toolText, drawMode === 'line' && styles.toolTextActive]}>划线</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.toolButton}
                onPress={clearAnnotations}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
                <Text style={styles.toolTextDanger}>清除</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.imageContainer}>
              <Image
                source={{ uri: imageUrl }}
                style={styles.image}
                resizeMode="contain"
              />
              {/* 标注层 */}
              <View
                style={styles.annotationLayer}
                onStartShouldSetResponder={() => true}
                onResponderRelease={handleImagePress}
              >
                {annotations.map((ann, index) => (
                  <View
                    key={index}
                    style={[
                      styles.annotation,
                      ann.type === 'circle' ? styles.circleAnnotation : styles.lineAnnotation,
                      { left: ann.x - 15, top: ann.y - 15 },
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>

          {/* 评分区域 */}
          <View style={styles.gradeSection}>
            <Text style={styles.sectionTitle}>评分</Text>
            <TextInput
              style={styles.gradeInput}
              placeholder="输入分数（如：90、A、优秀）"
              value={grade}
              onChangeText={setGrade}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* 评语区域 */}
          <View style={styles.feedbackSection}>
            <Text style={styles.sectionTitle}>评语</Text>
            <TextInput
              style={styles.feedbackInput}
              placeholder="输入批改意见..."
              value={feedback}
              onChangeText={setFeedback}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              placeholderTextColor="#9CA3AF"
            />
          </View>
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
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  imageSection: {
    padding: 16,
  },
  toolbar: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    gap: 6,
  },
  toolButtonActive: {
    backgroundColor: '#DBEAFE',
  },
  toolText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  toolTextActive: {
    color: '#3B82F6',
  },
  toolTextDanger: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '500',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 0.75,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  annotationLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  annotation: {
    position: 'absolute',
  },
  circleAnnotation: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  lineAnnotation: {
    width: 30,
    height: 3,
    backgroundColor: '#EF4444',
    borderRadius: 2,
  },
  gradeSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  gradeInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1F2937',
  },
  feedbackSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  feedbackInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1F2937',
    minHeight: 120,
  },
});
