import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import { getApiBaseUrl } from '@/utils/apiConfig';
import { Ionicons } from '@expo/vector-icons';

const TYPES = ['单选', '翻译句', '段落翻译', '阅读理解', '七选五', '完形填空', '语法填空'];
const DURATIONS = [10, 15, 20, 30, 45, 60];
const CLASSES = ['318班', '201班'];

interface Stu {
  userId: string;
  name: string;
  level: number;
  isPilot?: boolean;
  phone?: string;
}

export default function AdaptiveTraining() {
  const router = useSafeRouter();
  const { user } = useAuth();
  const [className, setClassName] = useState('318班');
  const [students, setStudents] = useState<Stu[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [types, setTypes] = useState<Set<string>>(new Set(['单选', '翻译句']));
  const [duration, setDuration] = useState(20);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`${getApiBaseUrl()}/api/v1/adaptive/students?className=${encodeURIComponent(className)}`, {
      headers: { Authorization: `Bearer ${user?.token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const list: Stu[] = d?.data?.students || [];
        setStudents(list);
        setSelected(new Set(list.map((s) => s.userId)));
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [className, user?.token]);

  const toggleType = (t: string) => {
    setTypes((prev) => {
      const n = new Set(prev);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return n;
    });
  };
  const toggleStu = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const handleAssign = async () => {
    if (types.size === 0) return setMsg('请至少选择一种题型');
    if (selected.size === 0) return setMsg('请至少选择一名学生');
    setMsg('正在按能力生成题目，学生越多越慢，请稍候…');
    setAssigning(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/adaptive/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify({
          className,
          questionTypes: Array.from(types),
          durationMin: duration,
          students: students
            .filter((s) => selected.has(s.userId))
            .map((s) => ({ userId: s.userId, name: s.name, level: s.level, phone: s.phone || '' })),
        }),
      });
      const d = await res.json();
      const results = d?.data?.results || [];
      const ok = results.filter((r: any) => r.ok).length;
      const fail = results.length - ok;
      setMsg(`布置完成：成功 ${ok} 人${fail ? `，失败 ${fail} 人` : ''}。学生端「我的训练」可查看。`);
    } catch {
      setMsg('布置失败：网络错误，请重试');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Screen>
      <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
        <View className="flex-row items-center px-4 py-3 bg-white border-b border-gray-200">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#333" />
          </TouchableOpacity>
          <Text className="ml-3 text-lg font-bold text-gray-900">一键万法 · 个性化布置</Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          <Text className="text-sm font-bold text-gray-700 mb-2">班级</Text>
          <View className="flex-row mb-4">
            {CLASSES.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setClassName(c)}
                className={`px-4 py-2 rounded-full mr-2 ${
                  className === c ? 'bg-purple-600' : 'bg-white border border-gray-300'
                }`}
              >
                <Text className={className === c ? 'text-white' : 'text-gray-700'}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text className="text-sm font-bold text-gray-700 mb-2">
            题型（题型相同，难度按能力自适应）
          </Text>
          <View className="flex-row flex-wrap mb-4">
            {TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => toggleType(t)}
                className={`px-3 py-2 rounded-full mr-2 mb-2 ${
                  types.has(t) ? 'bg-purple-600' : 'bg-white border border-gray-300'
                }`}
              >
                <Text className={types.has(t) ? 'text-white text-sm' : 'text-gray-700 text-sm'}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text className="text-sm font-bold text-gray-700 mb-2">训练时长</Text>
          <View className="flex-row flex-wrap mb-4">
            {DURATIONS.map((d) => (
              <TouchableOpacity
                key={d}
                onPress={() => setDuration(d)}
                className={`px-3 py-2 rounded-full mr-2 mb-2 ${
                  duration === d ? 'bg-blue-600' : 'bg-white border border-gray-300'
                }`}
              >
                <Text className={duration === d ? 'text-white text-sm' : 'text-gray-700 text-sm'}>
                  {d} 分钟
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text className="text-sm font-bold text-gray-700 mb-2">学生（按能力生成不同难度）</Text>
          {loading ? (
            <ActivityIndicator className="my-6" />
          ) : (
            <View className="mb-4">
              {students.map((s) => (
                <TouchableOpacity
                  key={s.userId}
                  onPress={() => toggleStu(s.userId)}
                  className="flex-row items-center bg-white rounded-lg px-3 py-2 mb-2"
                >
                  <Ionicons
                    name={selected.has(s.userId) ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={selected.has(s.userId) ? '#7C3AED' : '#9CA3AF'}
                  />
                  <Text className="ml-2 text-gray-900">{s.name}</Text>
                  {s.isPilot && (
                    <Text className="ml-2 text-xs text-orange-500">
                      试点{s.phone ? `·${s.phone}` : ''}
                    </Text>
                  )}
                  <View className="ml-auto bg-purple-100 rounded-full px-2 py-0.5">
                    <Text className="text-xs text-purple-700">L{s.level}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        {msg !== '' && (
          <View className="px-4 py-2 bg-blue-50 border-t border-blue-200">
            <Text className="text-blue-700 text-sm">{msg}</Text>
          </View>
        )}

        <View className="p-4 bg-white border-t border-gray-200">
          <TouchableOpacity
            onPress={handleAssign}
            disabled={assigning}
            className="bg-purple-600 rounded-xl py-3 items-center flex-row justify-center"
          >
            {assigning && <ActivityIndicator color="#fff" />}
            <Text className="text-white font-bold ml-2">
              {assigning ? '布置中…' : '一键布置作业'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Screen>
  );
}
