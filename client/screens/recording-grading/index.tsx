import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { getApiBaseUrl } from '@/utils/apiConfig';

interface RecordingBlank {
  page: number;
  part: string;
  term: string;
  student_answer: string;
  reference_answer: string;
  is_correct: boolean;
  points: number;
  gained: number;
  note: string;
}

interface RecordingResult {
  blanks: RecordingBlank[];
  total_score: number;
  max_score: number;
  comments: string;
}

const MAX_PAGES = 6;

export default function RecordingGradingScreen() {
  const router = useSafeRouter();
  const { user } = useAuth();

  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [referenceAnswer, setReferenceAnswer] = useState('');
  const [maxScore, setMaxScore] = useState('60');
  const [lang, setLang] = useState<'en' | 'ch'>('en');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecordingResult | null>(null);
  const [markedImages, setMarkedImages] = useState<string[]>([]);

  const canAddMore = selectedImages.length < MAX_PAGES;

  const appendImages = (uris: string[]) => {
    if (!uris.length) return;
    const remaining = MAX_PAGES - selectedImages.length;
    const toAdd = uris.slice(0, remaining);
    if (!toAdd.length) return;
    setSelectedImages((prev) => [...prev, ...toAdd].slice(0, MAX_PAGES));
    setResult(null);
    setMarkedImages([]);
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    setResult(null);
    setMarkedImages([]);
  };

  const pickImage = async () => {
    if (!canAddMore) return;
    const picker = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PAGES - selectedImages.length,
    });
    if (!picker.canceled && picker.assets.length) {
      appendImages(picker.assets.map((a) => a.uri));
    }
  };

  const takePhoto = async () => {
    if (!canAddMore) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('需要相机权限', '请在设置中允许访问相机');
      return;
    }
    const shot = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.85,
    });
    if (!shot.canceled && shot.assets[0]) {
      appendImages([shot.assets[0].uri]);
    }
  };

  const handleGrade = async () => {
    if (!selectedImages.length) {
      Alert.alert('提示', '请先选择试卷图片');
      return;
    }
    setLoading(true);
    try {
      const images: string[] = [];
      for (const uri of selectedImages) {
        const compressed = await manipulateAsync(
          uri,
          [{ resize: { width: 1200 } }],
          { compress: 0.7, format: SaveFormat.JPEG },
        );
        const blob = await (await fetch(compressed.uri)).blob();
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        images.push(base64);
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user?.token) headers['Authorization'] = `Bearer ${user.token}`;

      const response = await fetch(`${getApiBaseUrl()}/api/v1/essay-grading/recording-grade`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          images,
          reference_answer: referenceAnswer,
          max_score: parseInt(maxScore, 10) || 0,
          lang,
        }),
        signal: AbortSignal.timeout(300000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      if (data.success) {
        setResult(data.data.grading);
        setMarkedImages(data.data.marked_images || []);
      } else {
        const msg = data.error || '未知错误';
        if (Platform.OS === 'web') alert('录题判分失败：' + msg);
        else Alert.alert('录题判分失败', msg);
      }
    } catch (error: any) {
      const msg = error.message || '网络错误';
      if (Platform.OS === 'web') alert('录题判分失败：' + msg);
      else Alert.alert('录题判分失败', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-gray-100">
      {/* 顶部标题栏 */}
      <View className="flex-row items-center justify-between px-4 pt-12 pb-3 bg-white border-b border-gray-200">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-900">录题判分</Text>
        <View className="w-8" />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* 1. 上传卷子 */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-base font-semibold text-gray-800 mb-3">1. 上传卷子图片</Text>
          {selectedImages.length > 0 && (
            <View className="flex-row flex-wrap mb-3">
              {selectedImages.map((uri, idx) => (
                <View key={idx} className="mr-2 mb-2">
                  <Image source={{ uri }} className="w-20 h-20 rounded-lg bg-gray-200" resizeMode="contain" />
                  {!loading && (
                    <TouchableOpacity
                      className="absolute -top-2 -right-2 bg-white rounded-full"
                      onPress={() => removeImage(idx)}
                    >
                      <Ionicons name="close-circle" size={22} color="#ff3b30" />
                    </TouchableOpacity>
                  )}
                  <Text className="text-xs text-gray-500 mt-1 text-center">第{idx + 1}页</Text>
                </View>
              ))}
            </View>
          )}
          <View className="flex-row">
            {canAddMore && (
              <TouchableOpacity
                className="flex-1 mr-2 h-24 rounded-lg border-2 border-dashed border-green-500 items-center justify-center"
                onPress={takePhoto}
              >
                <Ionicons name="camera-outline" size={28} color="#16A34A" />
                <Text className="mt-1 text-sm text-green-600">拍照</Text>
              </TouchableOpacity>
            )}
            {canAddMore && (
              <TouchableOpacity
                className="flex-1 ml-2 h-24 rounded-lg border-2 border-dashed border-green-500 items-center justify-center"
                onPress={pickImage}
              >
                <Ionicons name="images-outline" size={28} color="#16A34A" />
                <Text className="mt-1 text-sm text-green-600">从相册选择</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 2. 判分设置 */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-base font-semibold text-gray-800 mb-3">2. 判分设置</Text>

          {/* 语言 */}
          <Text className="text-sm text-gray-600 mb-1">答案语言</Text>
          <View className="flex-row mb-3">
            {(['en', 'ch'] as const).map((l) => (
              <TouchableOpacity
                key={l}
                className={`flex-1 py-2 rounded-lg mr-2 items-center ${lang === l ? 'bg-blue-500' : 'bg-gray-100'}`}
                onPress={() => setLang(l)}
              >
                <Text className={`text-sm font-medium ${lang === l ? 'text-white' : 'text-gray-700'}`}>
                  {l === 'en' ? '英文答案' : '中文答案'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 满分 */}
          <Text className="text-sm text-gray-600 mb-1">卷面总分</Text>
          <TextInput
            className="h-11 border border-gray-300 rounded-lg px-3 mb-3 bg-white text-gray-900"
            value={maxScore}
            onChangeText={setMaxScore}
            keyboardType="numeric"
            placeholder="例如 60"
            placeholderTextColor="#9CA3AF"
          />

          {/* 参考答案 */}
          <Text className="text-sm text-gray-600 mb-1">标准答案（可留空，模型按题干推断）</Text>
          <TextInput
            className="min-h-[100px] border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 text-left"
            value={referenceAnswer}
            onChangeText={setReferenceAnswer}
            multiline
            placeholder="可粘贴标准答案，模型将逐空对照判分；留空则按题干与常识判定正确写法"
            placeholderTextColor="#9CA3AF"
            textAlignVertical="top"
          />
        </View>

        {/* 开始 */}

        {loading ? (
          <View className="items-center py-6">
            <ActivityIndicator size="large" color="#16A34A" />
            <Text className="mt-3 text-sm text-gray-500">正在识别题目与逐空判分，约需 30-60 秒…</Text>
          </View>
        ) : (
          <TouchableOpacity
            className="h-12 rounded-full bg-green-500 items-center justify-center"
            onPress={handleGrade}
            disabled={!selectedImages.length}
            style={{ opacity: selectedImages.length ? 1 : 0.5 }}
          >
            <Text className="text-white font-semibold text-base">开始录题判分</Text>
          </TouchableOpacity>
        )}

        {/* 结果 */}
        {result && (
          <View className="mt-6">
            <View className="bg-white rounded-xl p-4 mb-4 flex-row items-center justify-between border border-gray-200">
              <Text className="text-gray-600">总分</Text>
              <Text className="text-3xl font-bold text-green-600">
                {result.total_score}
                <Text className="text-lg text-gray-400"> / {result.max_score || '—'}</Text>
              </Text>
            </View>

            {result.blanks.length > 0 && (
              <View className="mb-4">
                <View className="bg-white rounded-xl p-4 mb-4">
                  <Text className="text-base font-semibold text-gray-800 mb-3">卷面标注（点击可查看批注位置）</Text>
                  {markedImages.length > 0 ? (
                    markedImages.map((img, idx) => (
                      <Image key={idx} source={{ uri: img }} className="w-full h-[520px] rounded-xl bg-white mb-3" resizeMode="contain" />
                    ))
                  ) : (
                    <Text className="text-sm text-gray-400">暂未生成标注图</Text>
                  )}
                </View>
              </View>
            )}

            {result.comments ? (
              <View className="bg-white rounded-xl p-4 mb-4">
                <Text className="text-sm text-gray-600">{result.comments}</Text>
              </View>
            ) : null}

            <View className="bg-white rounded-xl p-4 mb-4">
              <Text className="text-base font-semibold text-gray-800 mb-3">逐空判分（{result.blanks.length} 空）</Text>
              {result.blanks.map((b, idx) => (
                <View
                  key={idx}
                  className="flex-row items-start py-2 border-b border-gray-100 last:border-b-0"
                >
                  <View
                    className={`w-6 h-6 rounded-full items-center justify-center mr-2 mt-0.5 ${b.is_correct ? 'bg-green-500' : 'bg-red-500'}`}
                  >
                    <Text className="text-white font-bold">{b.is_correct ? '✓' : '✗'}</Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row justify-between">
                      <Text className="text-sm text-gray-400 flex-1 pr-2">
                        {b.part ? `${b.part} · ` : ''}第{idx + 1}空
                      </Text>
                      <Text className={`text-sm font-semibold ${b.is_correct ? 'text-green-600' : 'text-red-500'}`}>
                        {b.gained}/{b.points}
                      </Text>
                    </View>
                    {b.term ? <Text className="text-sm text-gray-700 mt-0.5">题干：{b.term}</Text> : null}
                    <Text className="text-sm text-gray-800 mt-0.5">
                      学生：<Text className={b.is_correct ? 'text-green-700' : 'text-red-600'}>{b.student_answer || '（未作答）'}</Text>
                    </Text>
                    {!b.is_correct && b.reference_answer ? (
                      <Text className="text-sm text-green-600 mt-0.5">正确：{b.reference_answer}</Text>
                    ) : null}
                    {b.note ? <Text className="text-xs text-gray-400 mt-0.5">{b.note}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}