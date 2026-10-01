import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import { getApiBaseUrl } from '@/utils/apiConfig';
import { Ionicons } from '@expo/vector-icons';

interface SetItem {
  id: string;
  className: string;
  level: number;
  questionTypes: string[];
  durationMin: number;
  questions: any[];
  createdAt: string;
}

function QuestionCard({ q, index }: { q: any; index: number }) {
  const [show, setShow] = useState(false);
  const type = q?.type || '题目';
  return (
    <View className="bg-white rounded-xl p-3 mb-3">
      <View className="flex-row items-center mb-2">
        <View className="bg-blue-100 rounded-full px-2 py-0.5 mr-2">
          <Text className="text-xs text-blue-700">{type}</Text>
        </View>
        <Text className="text-xs text-gray-400">第 {index + 1} 题</Text>
      </View>

      {q?.passage ? <Text className="text-gray-900 text-sm leading-6 mb-2">{q.passage}</Text> : null}
      {q?.q ? <Text className="text-gray-900 text-sm leading-6 mb-2">{q.q}</Text> : null}

      {Array.isArray(q?.options) && (
        <View className="mb-2">
          {q.options.map((op: string, i: number) => (
            <Text key={i} className="text-gray-800 text-sm leading-6">
              {String.fromCharCode(65 + i)}. {op}
            </Text>
          ))}
        </View>
      )}

      {Array.isArray(q?.items) && (
        <View className="mb-2">
          {q.items.map((it: any, i: number) => (
            <View key={i} className="mb-2">
              {it.q ? <Text className="text-gray-900 text-sm">{i + 1}. {it.q}</Text> : null}
              {Array.isArray(it.options) &&
                it.options.map((op: string, j: number) => (
                  <Text key={j} className="text-gray-800 text-sm leading-6">
                    {String.fromCharCode(65 + j)}. {op}
                  </Text>
                ))}
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity onPress={() => setShow(!show)} className="mt-1">
        <Text className="text-blue-600 text-sm">{show ? '收起答案' : '显示答案'}</Text>
      </TouchableOpacity>
      {show && (
        <View className="mt-2 bg-green-50 rounded-lg p-2">
          {q?.answer ? <Text className="text-green-800 text-sm">答案：{q.answer}</Text> : null}
          {Array.isArray(q?.answers) && (
            <Text className="text-green-800 text-sm">答案：{q.answers.join('、')}</Text>
          )}
          {Array.isArray(q?.items) &&
            q.items.map((it: any, i: number) =>
              it.answer ? (
                <Text key={i} className="text-green-800 text-sm">
                  {i + 1}. {it.answer}
                </Text>
              ) : null
            )}
          {q?.explain ? <Text className="text-green-700 text-xs mt-1">解析：{q.explain}</Text> : null}
        </View>
      )}
    </View>
  );
}

export default function MyTraining() {
  const router = useSafeRouter();
  const { user } = useAuth();
  const [sets, setSets] = useState<SetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<SetItem | null>(null);
  const [remain, setRemain] = useState(0);

  useEffect(() => {
    fetch(`${getApiBaseUrl()}/api/v1/adaptive/my-sets`, {
      headers: { Authorization: `Bearer ${user?.token}` },
    })
      .then((r) => r.json())
      .then((d) => setSets(d?.data?.sets || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.token]);

  useEffect(() => {
    if (!active) return;
    setRemain(active.durationMin * 60);
    const t = setInterval(() => setRemain((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [active]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <Screen>
      <View className="flex-1 bg-gray-50">
        <View className="flex-row items-center px-4 py-3 bg-white border-b border-gray-200">
          <TouchableOpacity onPress={() => (active ? setActive(null) : router.back())}>
            <Ionicons name="arrow-back" size={22} color="#333" />
          </TouchableOpacity>
          <Text className="ml-3 text-lg font-bold text-gray-900">我的训练</Text>
          {active && (
            <View className="ml-auto bg-blue-100 rounded-full px-3 py-1">
              <Text className="text-blue-700 font-bold">{fmt(remain)}</Text>
            </View>
          )}
        </View>

        <ScrollView className="flex-1 p-4">
          {loading ? (
            <ActivityIndicator className="my-8" />
          ) : active ? (
            (active.questions || []).map((q, i) => <QuestionCard key={i} q={q} index={i} />)
          ) : sets.length === 0 ? (
            <Text className="text-gray-400 text-center mt-10">暂无训练任务</Text>
          ) : (
            sets.map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => setActive(s)}
                className="bg-white rounded-xl p-4 mb-3"
              >
                <View className="flex-row items-center">
                  <Text className="text-gray-900 font-bold">
                    {s.className} · 限时 {s.durationMin} 分钟
                  </Text>
                  <View className="ml-auto bg-purple-100 rounded-full px-2 py-0.5">
                    <Text className="text-xs text-purple-700">L{s.level}</Text>
                  </View>
                </View>
                <Text className="text-gray-500 text-sm mt-1">
                  {(s.questionTypes || []).join(' / ')} · 共 {(s.questions || []).length} 题
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    </Screen>
  );
}
