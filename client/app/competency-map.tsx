import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import { getApiBaseUrl } from '@/utils/apiConfig';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const RADAR_SIZE = Math.min(SCREEN_WIDTH - 60, 340);

interface Ability { label: string; value: number | null; correct: number; wrong: number; total: number; }
interface KP { name: string; correct: number; wrong: number; total: number; }
interface Named { name: string; count: number; }
interface Diff { level: string; count: number; }

function RadarChart({ data, hasData }: { data: Ability[]; hasData: boolean }) {
  const n = data.length;
  const center = RADAR_SIZE / 2;
  const levels = 5;
  const angleStep = (Math.PI * 2) / n;
  const point = (index: number, value: number, radiusRatio: number) => {
    const angle = angleStep * index - Math.PI / 2;
    const radius = center * value * radiusRatio;
    return { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) };
  };
  const radiusMax = 0.78;
  const grid = (level: number) => data.map((_, i) => { const p = point(i, level / levels, radiusMax); return `${p.x},${p.y}`; }).join(' ');
  const dataPts = data.map((_, i) => { const p = point(i, hasData ? Math.max(0.05, data[i].value ?? 0.2) : 0.2, radiusMax); return `${p.x},${p.y}`; }).join(' ');
  return (
    <svg width={RADAR_SIZE} height={RADAR_SIZE} viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}>
      {Array.from({ length: levels }, (_, i) => (
        <polygon key={`g-${i}`} points={grid(i + 1)} fill="none" stroke="#E5E7EB" strokeWidth="1" />
      ))}
      {data.map((_, i) => {
        const p = point(i, 1, radiusMax);
        return <line key={`a-${i}`} x1={center} y1={center} x2={p.x} y2={p.y} stroke="#E5E7EB" strokeWidth="1" />;
      })}
      <polygon points={dataPts} fill="rgba(59,130,246,0.22)" stroke={hasData ? '#3B82F6' : '#CBD5E1'} strokeWidth="2" />
      {data.map((item, i) => {
        const p = point(i, hasData ? Math.max(0.05, item.value ?? 0.2) : 0.2, radiusMax);
        return <circle key={`p-${i}`} cx={p.x} cy={p.y} r="4" fill={item.total > 0 ? '#3B82F6' : '#CBD5E1'} />;
      })}
      {data.map((item, i) => {
        const p = point(i, 1.16, radiusMax);
        return (
          <text key={`l-${i}`} x={p.x} y={p.y + 4} textAnchor="middle" fontSize="11" fill="#374151" fontWeight="600">
            {item.label}
          </text>
        );
      })}
    </svg>
  );
}

export default function CompetencyMapScreen() {
  const router = useSafeRouter();
  const { user } = useAuth();
  const [abilities, setAbilities] = useState<Ability[]>([]);
  const [knowledge, setKnowledge] = useState<KP[]>([]);
  const [competency, setCompetency] = useState<Named[]>([]);
  const [difficulty, setDifficulty] = useState<Diff[]>([]);
  const [subjects, setSubjects] = useState<Named[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${getApiBaseUrl()}/api/v1/competency-map`, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      const d = await res.json();
      if (d?.success) {
        const data = d.data;
        setAbilities(data?.abilities || []);
        setKnowledge(data?.knowledge || []);
        setCompetency(data?.competency || []);
        setDifficulty(data?.difficulty || []);
        setSubjects(data?.subjects || []);
        setTotal(data?.total || 0);
        setFailed(false);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [user?.token]);

  useEffect(() => { load(); }, [load]);

  const hasData = (abilities || []).some((a) => a.total > 0);

  return (
    <Screen>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>能力图谱</Text>
        <View style={styles.placeholder} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#3B82F6" /></View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <Text style={styles.caption}>由你的收藏/错题数据（知识点·核心素养·难度）归类生成，浅色项为暂无该维度数据</Text>

          {failed ? (
            <View style={styles.emptyBox}><Text style={styles.emptyText}>数据加载失败，请稍后重试</Text></View>
          ) : abilities.length === 0 ? (
            <View style={styles.emptyBox}><Text style={styles.emptyText}>暂无错题数据，先去收藏/记录一些题目吧</Text></View>
          ) : (
            <>
              {/* 能力雷达：按既有能力项目归类 */}
              <Text style={styles.sectionTitle}>能力雷达（掌握度）</Text>
              <View style={styles.chartContainer}>
                {hasData && <RadarChart data={abilities} hasData />}
                <Text style={styles.pctHint}>外圈为 L{6}</Text>
              </View>
              {!hasData && (
                <View style={styles.emptyBox}><Text style={styles.emptyText}>还没有任何能力项有数据，记录题目后可在这里看到掌握度雷达</Text></View>
              )}

              {/* 学科分布 */}
              {subjects.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>学科分布</Text>
                  <View style={styles.tagWrap}>
                    {subjects.map((s, i) => (
                      <View key={i} style={styles.tag}><Text style={styles.tagText}>{s.name} × {s.count}</Text></View>
                    ))}
                  </View>
                </>
              )}

              {/* 知识点掌握（最薄弱在前） */}
              {knowledge.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>知识点掌握度</Text>
                  {knowledge.map((k, i) => {
                    const pct = Math.round((k.correct / k.total) * 100);
                    return (
                      <View key={i} style={styles.kpRow}>
                        <Text style={styles.kpName} numberOfLines={1}>{k.name}</Text>
                        <View style={styles.kpBar}>
                          <View style={[styles.kpFill, { width: `${pct}%`, backgroundColor: pct >= 60 ? '#22C55E' : pct >= 40 ? '#F59E0B' : '#EF4444' }]} />
                        </View>
                        <Text style={styles.kpPct}>{pct}%</Text>
                        <Text style={styles.kpCount}>{k.correct}对/{k.wrong}错</Text>
                      </View>
                    );
                  })}
                </>
              )}

              {/* 核心素养分布 */}
              {competency.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>学科核心素养</Text>
                  <View style={styles.tagWrap}>
                    {competency.map((c, i) => (
                      <View key={i} style={styles.tag}><Text style={styles.tagText}>{c.name} × {c.count}</Text></View>
                    ))}
                  </View>
                </>
              )}

              {/* 难度分布 L1-L6 */}
              {difficulty.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>难度分布（L1-L6）</Text>
                  <View style={styles.diffWrap}>
                    {['L1', 'L2', 'L3', 'L4', 'L5', 'L6'].map((lv) => {
                      const hit = difficulty.find((d) => d.level === lv);
                      const max = Math.max(1, ...difficulty.map((d) => d.count));
                      const h = hit ? Math.round((hit.count / max) * 60) : 0;
                      return (
                        <View key={lv} style={styles.diffCol}>
                          <Text style={styles.diffBarText}>{hit ? hit.count : ''}</Text>
                          <View style={[styles.diffBar, { height: h }]} />
                          <Text style={styles.diffLabel}>{lv}</Text>
                        </View>
                      );
                    })}
                  </View>
                </>
              )}

              <Text style={styles.foot}>共 {total} 条记录</Text>
            </>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#FFFFFF' },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  placeholder: { width: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 120 },
  scroll: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 16, paddingBottom: 48 },
  caption: { fontSize: 12, color: '#9CA3AF', marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginTop: 18, marginBottom: 10 },
  chartContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  pctHint: { fontSize: 11, color: '#9CA3AF', marginTop: 6 },
  emptyBox: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 24, alignItems: 'center', marginTop: 12 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: '#EEF2F7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  tagText: { fontSize: 13, color: '#374151' },
  kpRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  kpName: { width: 110, fontSize: 13, color: '#374151' },
  kpBar: { flex: 1, height: 8, backgroundColor: '#EEF2F7', borderRadius: 4, marginHorizontal: 10, overflow: 'hidden' },
  kpFill: { height: '100%', borderRadius: 4 },
  kpPct: { width: 42, fontSize: 13, color: '#111827', textAlign: 'right', fontWeight: '600' },
  kpCount: { width: 66, fontSize: 12, color: '#9CA3AF', textAlign: 'right' },
  diffWrap: { flexDirection: 'row', alignItems: 'flex-end', height: 96 },
  diffCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  diffBar: { width: 18, backgroundColor: '#3B82F6', borderRadius: 3, marginBottom: 4 },
  diffBarText: { fontSize: 12, color: '#374151', marginBottom: 2 },
  diffLabel: { fontSize: 12, color: '#6B7280' },
  foot: { textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 20 },
});