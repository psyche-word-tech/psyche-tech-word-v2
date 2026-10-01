import { useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, ScrollView, ActivityIndicator,
  Alert, Platform, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { getApiBaseUrl } from '@/utils/apiConfig';

interface UpFile {
  uri: string;
  name: string;
  type: string;
  isImage: boolean;
}

export default function RecordingUploadScreen() {
  const router = useSafeRouter();
  const { user } = useAuth();
  const [files, setFiles] = useState<UpFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleTakePhoto = async () => {
    setShowPicker(false);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { alert('需要相机权限才能拍照'); return; }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newFiles = result.assets.map((a) => ({ uri: a.uri, name: `拍照_${Date.now()}.jpg`, type: 'image/jpeg', isImage: true }));
        setFiles((prev) => [...prev, ...newFiles]);
      }
    } catch (e) {
      console.error('Camera error:', e);
      alert('拍照失败，请重试');
    }
  };

  const handlePickFromLibrary = async () => {
    setShowPicker(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { alert('需要相册权限才能选择图片'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        allowsMultipleSelection: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newFiles = result.assets.map((a, idx) => ({ uri: a.uri, name: `相册图片_${Date.now()}_${idx}.jpg`, type: 'image/jpeg', isImage: true }));
        setFiles((prev) => [...prev, ...newFiles]);
      }
    } catch (e) {
      console.error('Image picker error:', e);
      alert('选择图片失败，请重试');
    }
  };

  const handlePickDocument = async () => {
    setShowPicker(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.wps-office.doc', 'application/vnd.wps-office.docx', 'image/*'],
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled) return;
      const newFiles = result.assets.map((f) => {
        const lower = (f.name || '').toLowerCase();
        const isImage = /\.(png|jpe?g|gif|webp|heic)$/.test(lower);
        return { uri: f.uri, name: f.name || '文件', type: isImage ? 'image/jpeg' : 'application/octet-stream', isImage };
      });
      setFiles((prev) => [...prev, ...newFiles]);
    } catch (e) {
      console.error('Document picker error:', e);
      alert('选择文件失败，请重试');
    }
  };

  const handleRemoveFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setLoading(true);
    try {
      const formData = new FormData();
      for (const f of files) {
        if (Platform.OS === 'web') {
          let blob: Blob;
          if (f.uri.startsWith('data:')) {
            const arr = f.uri.split(',');
            const mimeMatch = arr[0].match(/:(.*?);/);
            const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
            const bstr = atob(arr[1]);
            const u8 = new Uint8Array(bstr.length);
            for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
            blob = new Blob([u8], { type: mime || f.type });
          } else {
            const response = await fetch(f.uri);
            blob = await response.blob();
          }
          formData.append('files', blob, f.name);
        } else {
          formData.append('files', {
            uri: f.uri, name: f.name, type: f.type || 'application/octet-stream',
          } as any);
        }
      }

      // 服务端文件：server/src/routes/wrong-questions.ts
      // 接口：POST /api/v1/wrong-questions
      // Body: FormData 'files'（图片/PDF/Word），成功返回 subject 与 message
      const res = await fetch(`${getApiBaseUrl()}/api/v1/wrong-questions`, {
        method: 'POST',
        headers: user?.token ? { Authorization: `Bearer ${user.token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        const s = data.summary;
        const sumText = s && s.total > 0
          ? `共 ${s.total} 题：对 ${s.correct}、错 ${s.wrong}${s.attention ? `、重点关注 ${s.attention}` : ''}${s.blank ? `、未作答 ${s.blank}` : ''}${s.deduped ? `，其中 ${s.deduped} 题与已有重复已自动合并` : ''}，已计入能力图谱。`
          : '已记入错题。';
        setMsg({ type: 'ok', text: `上传成功，学科：${data.subject || '未知'}。${sumText}${data.warn ? data.warn : ''}` });
        setFiles([]);
        if (Platform.OS !== 'web') {
          Alert.alert('上传成功', `已自动识别学科：${data.subject || '未知'}`, [
            { text: '继续录题', style: 'cancel' },
            { text: '查看我的收藏', onPress: () => router.push('/my-favorites') },
          ]);
        }
      } else {
        setMsg({ type: 'err', text: data.message || '上传失败，请重试' });
        if (Platform.OS !== 'web') Alert.alert('上传失败', data.message || '请重试');
      }
    } catch (e) {
      console.error('Upload error:', e);
      setMsg({ type: 'err', text: '网络异常，请重试' });
      if (Platform.OS !== 'web') Alert.alert('上传失败', '网络异常，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>录题</Text>
          <TouchableOpacity style={styles.headerLink} onPress={() => router.push('/my-favorites')} activeOpacity={0.7}>
            <Text style={styles.headerLinkText}>我的错题</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          <Text style={styles.hint}>
            上传题目的图片或文档（Word / PDF），系统将自动识别题目所属学科并记录为你的错题，可在「我的收藏」按学科查看。
          </Text>

          {msg && (
            <View style={[styles.msgBanner, msg.type === 'ok' ? styles.msgOk : styles.msgErr]}>
              <Text style={[styles.msgText, msg.type === 'ok' ? styles.msgTextOk : styles.msgTextErr]}>{msg.text}</Text>
              {msg.type === 'ok' && (
                <TouchableOpacity onPress={() => router.push('/my-favorites')} activeOpacity={0.7}>
                  <Text style={styles.msgLinkText}>去查看</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* 已选文件 */}
          {files.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>已选文件（{files.length}）</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fileRow}>
                {files.map((f, idx) => (
                  <View key={idx} style={styles.fileCard}>
                    {f.isImage ? (
                      <Image source={{ uri: f.uri }} style={styles.fileThumb} resizeMode="cover" />
                    ) : (
                      <View style={[styles.fileThumb, styles.fileIconWrap]}>
                        <Ionicons name="document-text" size={30} color="#3B82F6" />
                      </View>
                    )}
                    <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
                    <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemoveFile(idx)} activeOpacity={0.7}>
                      <Ionicons name="close-circle" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* 选择来源 */}
          {!loading && (
            <View style={styles.actions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => setShowPicker(true)} activeOpacity={0.7}>
                <Ionicons name="images" size={20} color="#FFFFFF" />
                <Text style={styles.actionText}>添加试题</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.uploadBtn, files.length === 0 && styles.actionDisabled]}
                onPress={handleUpload}
                disabled={files.length === 0}
                activeOpacity={0.7}
              >
                <Ionicons name="cloud-upload" size={20} color="#FFFFFF" />
                <Text style={styles.actionText}>上传错题</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* 选择来源 Modal */}
        {showPicker && (
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowPicker(false)}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>添加试题</Text>
              <TouchableOpacity style={styles.modalButton} onPress={handleTakePhoto} activeOpacity={0.7}>
                <Ionicons name="camera" size={22} color="#333" />
                <Text style={styles.modalButtonText}>拍照</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButton} onPress={handlePickFromLibrary} activeOpacity={0.7}>
                <Ionicons name="images" size={22} color="#333" />
                <Text style={styles.modalButtonText}>从相册选择</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButton} onPress={handlePickDocument} activeOpacity={0.7}>
                <Ionicons name="document-text" size={22} color="#333" />
                <Text style={styles.modalButtonText}>上传文件（Word / PDF）</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowPicker(false)} activeOpacity={0.7}>
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}

        {/* 上传中遮罩 */}
        {loading && (
          <View style={styles.loadingMask}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>正在识别题目学科…</Text>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937' },
  headerLink: { paddingHorizontal: 8, paddingVertical: 6 },
  headerLinkText: { fontSize: 14, color: '#3B82F6', fontWeight: '600' },
  content: { flex: 1 },
  contentInner: { padding: 16, paddingBottom: 40 },
  hint: { fontSize: 14, color: '#6B7280', lineHeight: 22, marginBottom: 16 },
  msgBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16,
  },
  msgOk: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
  msgErr: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  msgText: { fontSize: 13, lineHeight: 20, flex: 1 },
  msgTextOk: { color: '#065F46' },
  msgTextErr: { color: '#991B1B' },
  msgLinkText: { fontSize: 13, color: '#059669', fontWeight: '700', marginLeft: 8 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 10 },
  fileRow: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
  fileCard: { width: 100, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 8, borderWidth: 1, borderColor: '#F3F4F6' },
  fileThumb: { width: 84, height: 84, borderRadius: 8, backgroundColor: '#EFF6FF' },
  fileIconWrap: { alignItems: 'center', justifyContent: 'center' },
  fileName: { fontSize: 11, color: '#4B5563', marginTop: 6 },
  removeBtn: { position: 'absolute', top: 2, right: 2 },
  actions: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#3B82F6', borderRadius: 12, paddingVertical: 14,
  },
  uploadBtn: { backgroundColor: '#10B981' },
  actionDisabled: { opacity: 0.4 },
  actionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%', backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 30,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', textAlign: 'center', marginBottom: 16 },
  modalButton: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12,
    backgroundColor: '#F9FAFB', marginBottom: 10,
  },
  modalButtonText: { fontSize: 15, color: '#1F2937', fontWeight: '500' },
  modalCancelButton: { alignItems: 'center', padding: 12, marginTop: 4 },
  modalCancelText: { fontSize: 15, color: '#9CA3AF', fontWeight: '600' },
  loadingMask: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center', zIndex: 99,
  },
  loadingText: { color: '#6B7280', fontSize: 14, marginTop: 12 },
});