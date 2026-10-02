import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import { getApiBaseUrl } from '@/utils/apiConfig';

const LEVELS = 6;
const RADAR_SIZE = 250;
const FOREIGN_LABELS = ['语音与词汇', '语法', '阅读理解', '书面表达', '听力与口语', '完形填空'];
const WRITING_INDEX = 3;

interface Student {
  userId: string;
  name: string;
  sampleCount: number;
  level: number | null;
  grammarLevel: number | null;
  grammarWeakPoints?: { category: string; count: number; examples: string[] }[];
}
interface ClassGroup {
  className: string;
  students: Student[];
  classLevel: number | null;
  grammarClassLevel: number | null;
  sampleCount: number;
}

function Radar({ labels, values, color = '#3B82F6' }: { labels: string[]; values: number[]; color?: string }) {
  const n = values.length;
  const center = RADAR_SIZE / 2;
  const angleStep = (Math.PI * 2) / n;
  const radius = RADAR_SIZE / 2;
  const point = (index: number, value: number) => {
    const angle = angleStep * index - Math.PI / 2;
    const r = radius * 0.8 * (value / LEVELS);
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  };
  const ring = (level: number) => values.map((_, i) => { const p = point(i, level); return `${p.x},${p.y}`; }).join(' ');
  const data = () => values.map((_, i) => { const p = point(i, values[i]); return `${p.x},${p.y}`; }).join(' ');
  return (
    <svg width={RADAR_SIZE} height={RADAR_SIZE} viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}>
      {Array.from({ length: LEVELS }, (_, i) => (
        <polygon key={`g-${i}`} points={ring(i + 1)} fill="none" stroke="#E5E7EB" strokeWidth={i === LEVELS - 1 ? 1.5 : 1} />
      ))}
      {values.map((_, i) => {
        const p = point(i, LEVELS);
        return <line key={`a-${i}`} x1={center} y1={center} x2={p.x} y2={p.y} stroke="#E5E7EB" strokeWidth="1" />;
      })}
      <polygon points={data()} fill="rgba(59,130,246,0.22)" stroke={color} strokeWidth="2" />
      {values.map((_, i) => (
        <circle key={`d-${i}`} cx={point(i, values[i]).x} cy={point(i, values[i]).y} r="4" fill={color} />
      ))}
      {labels.map((label, i) => {
        const p = point(i, LEVELS);
        return (
          <text key={`l-${i}`} x={p.x} y={p.y + (p.y <= center ? -8 : 16)} textAnchor="middle" fontSize="9" fill="#374151" fontWeight="600">
            {label}
          </text>
        );
      })}
    </svg>
  );
}

// 外语六维基础值（演示基线），书面表达与语法用真实作文数据覆盖
const GRAMMAR_INDEX = 1;
function buildValues(writingLevel: number | null, grammarLevel: number | null): number[] {
  const v = [3, 3, 3, 3, 3, 3];
  if (writingLevel != null) v[WRITING_INDEX] = writingLevel;
  if (grammarLevel != null) v[GRAMMAR_INDEX] = grammarLevel;
  return v;
}

export default function LearningOverviewScreen() {
  const router = useSafeRouter();
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, Student | null>>({});
  const [grammarOpen, setGrammarOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/v1/essay-grading/writing-overview`, {
          headers: { Authorization: `Bearer ${user?.token}` },
        });
        const d = await res.json();
        if (d?.success) setClasses(d.data?.classes || []);
      } catch {
        setClasses([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.token]);

  const totalStudents = useMemo(() => classes.reduce((a, c) => a + c.students.length, 0), [classes]);

  return (
    <Screen>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>学情一览</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>书面表达能力由学生真实作文批改数据生成（学生端不展示）</Text>

        {loading ? (
          <ActivityIndicator style={styles.loader} color="#3B82F6" />
        ) : classes.length === 0 ? (
          <Text style={styles.empty}>暂无作文数据</Text>
        ) : (
          classes.map((cls) => {
            const sel = selected[cls.className] || null;
            return (
              <View key={cls.className} style={styles.classCard}>
                <View style={styles.classHead}>
                  <Text style={styles.className}>{cls.className}</Text>
                  <Text style={styles.classMeta}>{cls.students.length} 人 · 作文 {cls.sampleCount} 篇</Text>
                </View>

                <Text style={styles.sectionLabel}>班级整体能力图谱</Text>
                <View style={styles.radarWrap}>
                  <Radar labels={FOREIGN_LABELS} values={buildValues(cls.classLevel, cls.grammarClassLevel)} color="#8B5CF6" />
                </View>
                <Text style={styles.classLevelText}>
                  班级书面表达 {cls.classLevel != null ? `L${cls.classLevel}` : '—'} · 语法 {cls.grammarClassLevel != null ? `L${cls.grammarClassLevel}` : '—'}
                </Text>

                <Text style={styles.sectionLabel}>学生能力图谱（点击姓名查看）</Text>
                <View style={styles.studentChips}>
                  {cls.students.map((s) => (
                    <TouchableOpacity
                      key={s.userId}
                      style={[styles.chip, sel?.userId === s.userId && styles.chipActive]}
                      onPress={() => setSelected((p) => ({ ...p, [cls.className]: sel?.userId === s.userId ? null : s }))}
                    >
                      <Text style={[styles.chipText, sel?.userId === s.userId && styles.chipTextActive]}>
                        {s.name} {s.level != null ? `L${s.level}` : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {sel && (
                  <View style={styles.studentRadar}>
                    <Text style={styles.studentRadarTitle}>
                      {sel.name} 的能力图谱（书面表达 L{sel.level ?? '—'} · 语法 L{sel.grammarLevel ?? '—'} · 作文 {sel.sampleCount} 篇）
                    </Text>
                    <View style={styles.radarWrap}>
                      <Radar labels={FOREIGN_LABELS} values={buildValues(sel.level, sel.grammarLevel)} color="#10B981" />
                    </View>
                    <TouchableOpacity
                      style={styles.grammarToggle}
                      onPress={() => setGrammarOpen((p) => ({ ...p, [cls.className]: !p[cls.className] }))}
                    >
                      <Text style={styles.grammarToggleText}>
                        语法 L{sel.grammarLevel ?? '—'} · {grammarOpen[cls.className] ? '收起薄弱点 ▴' : '点击查看语法薄弱点 ▾'}
                      </Text>
                    </TouchableOpacity>
                    {grammarOpen[cls.className] && (
                      <View style={styles.grammarPanel}>
                        {(sel.grammarWeakPoints || []).length === 0 ? (
                          <Text style={styles.grammarEmpty}>暂无语法错误记录，掌握良好</Text>
                        ) : (
                          (sel.grammarWeakPoints || []).map((w: any, i: number) => (
                            <View key={i} style={styles.grammarItem}>
                              <Text style={styles.grammarWord}>
                                {w.category || '其他语法'}
                                <Text style={styles.grammarCount}>（{w.count} 处）</Text>
                              </Text>
                              {(w.examples || []).map((ex: string, j: number) => (
                                <Text key={j} style={styles.grammarExplain}>例：{ex}</Text>
                              ))}
                            </View>
                          ))
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#fff' },
  backBtn: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 20, color: '#374151' },
  title: { fontSize: 17, fontWeight: '700', color: '#111827' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  subtitle: { fontSize: 12, color: '#6B7280', marginBottom: 12 },
  loader: { marginTop: 40 },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40 },
  classCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  classHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  className: { fontSize: 16, fontWeight: '700', color: '#111827' },
  classMeta: { fontSize: 12, color: '#6B7280' },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginVertical: 6 },
  radarWrap: { alignItems: 'center' },
  classLevelText: { textAlign: 'center', fontSize: 13, fontWeight: '700', color: '#8B5CF6', marginTop: 4 },
  studentChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  chipActive: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' },
  chipText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  chipTextActive: { color: '#2563EB' },
  studentRadar: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  studentRadarTitle: { fontSize: 13, fontWeight: '700', color: '#10B981', marginBottom: 6, textAlign: 'center' },
  grammarToggle: { marginTop: 8, alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#10B981' },
  grammarToggleText: { fontSize: 13, fontWeight: '600', color: '#059669' },
  grammarPanel: { marginTop: 10, backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  grammarEmpty: { fontSize: 13, color: '#10B981', textAlign: 'center' },
  grammarItem: { marginBottom: 10 },
  grammarWord: { fontSize: 14, fontWeight: '600', color: '#DC2626' },
  grammarCount: { fontSize: 12, fontWeight: '400', color: '#9CA3AF' },
  grammarArrow: { color: '#6B7280' },
  grammarFix: { color: '#059669', fontWeight: '700' },
  grammarExplain: { fontSize: 12, color: '#6B7280', marginTop: 2 },
});
