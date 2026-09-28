import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { fetchWithRetry } from '@/utils/apiClient';
import { FontAwesome6 } from '@expo/vector-icons';
import { recommendStudent, matchFieldSpecialties, specHistoryScores, ABILITY_IDS, ABILITY_NAMES, ABILITY_COLORS, LevelSnapshot } from './recommend';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const RADAR_SIZE = Math.min(SCREEN_WIDTH - 64, 336);

const SUBJECTS = ['语文', '数学', '外语', '物理', '化学', '生物', '政治', '历史', '地理'];
const SUBJECT_COLORS = [
  '#EF5350', '#42A5F5', '#66BB6A', '#FFA726',
  '#AB47BC', '#26C6DA', '#EC407A', '#FF7043', '#8D6E63',
];
// 各学科当前能力等级示例（L1-L6），后续可接诊断数据
const SUBJECT_LEVELS: Record<string, number> = {
  语文: 5, 数学: 5, 外语: 4, 物理: 4, 化学: 4, 生物: 4, 政治: 4, 历史: 3, 地理: 3,
};

// 用户能力测评历史（localStorage，方案二：前端造历史）
const HISTORY_KEY = 'ability_graph_history_v1';

function loadHistory(): LevelSnapshot[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) return arr as LevelSnapshot[];
    }
  } catch { /* ignore */ }
  // 首次无历史：造 3 条演示快照（30/15 天前 + 当前），呈现趋势
  const now = Date.now();
  const base = SUBJECT_LEVELS;
  const older = { ...base, 数学: 4, 物理: 3, 化学: 3, 生物: 3 };
  const mid = { ...base, 物理: 3, 化学: 3 };
  const seed: LevelSnapshot[] = [
    { t: now - 30 * 86400000, l: older },
    { t: now - 15 * 86400000, l: mid },
    { t: now, l: base },
  ];
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(seed)); } catch { /* ignore */ }
  return seed;
}

const fmtTime = (t: number) => {
  const d = new Date(t);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
};

// 十个能力家族 R01-R10，能力分 6 级（level: 1-6，对应 L1-L6）
const ABILITIES = [
  { id: 'R01', name: '推理与论证', level: 5 },
  { id: 'R02', name: '批判性思维与创新', level: 4 },
  { id: 'R03', name: '证据与实证', level: 3 },
  { id: 'R04', name: '模型建构与抽象', level: 4 },
  { id: 'R05', name: '实验探究', level: 3 },
  { id: 'R06', name: '信息处理与量化', level: 4 },
  { id: 'R07', name: '表达与交流', level: 2 },
  { id: 'R08', name: '价值判断与社会责任', level: 5 },
  { id: 'R09', name: '文化理解与传承', level: 3 },
  { id: 'R10', name: '自主学习与元认知', level: 4 },
];

const LEVELS = 6;

// 通用雷达图：n 轴（3~10）、6 级（L1-L6）
function Radar({ labels, values, color = '#3B82F6', onLabelPress }: {
  labels: string[];
  values: number[];
  color?: string;
  onLabelPress?: (label: string) => void;
}) {
  const n = values.length;
  const center = RADAR_SIZE / 2;
  const angleStep = (Math.PI * 2) / n;
  const radius = RADAR_SIZE / 2;

  const point = (index: number, value: number) => {
    const angle = angleStep * index - Math.PI / 2;
    const r = radius * 0.82 * (value / LEVELS);
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  };

  const polygonPoints = (level: number) =>
    values.map((_, i) => {
      const p = point(i, level);
      return `${p.x},${p.y}`;
    }).join(' ');

  const dataPoints = () =>
    values.map((_, i) => {
      const p = point(i, values[i]);
      return `${p.x},${p.y}`;
    }).join(' ');

  return (
    <svg width={RADAR_SIZE} height={RADAR_SIZE} viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}>
      {/* 层级网格 L1-L6 */}
      {Array.from({ length: LEVELS }, (_, i) => (
        <polygon
          key={`grid-${i}`}
          points={polygonPoints(i + 1)}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={i === LEVELS - 1 ? 1.5 : 1}
        />
      ))}
      {/* 放射轴线 */}
      {values.map((_, i) => {
        const p = point(i, LEVELS);
        return <line key={`axis-${i}`} x1={center} y1={center} x2={p.x} y2={p.y} stroke="#E5E7EB" strokeWidth="1" />;
      })}
      {/* 数据区域 */}
      <polygon points={dataPoints()} fill="rgba(59,130,246,0.25)" stroke={color} strokeWidth="2" />
      {/* 数据点 */}
      {values.map((_, i) => (
        <circle key={`dot-${i}`} cx={point(i, values[i]).x} cy={point(i, values[i]).y} r="4" fill={color} />
      ))}
      {/* 顶点标签 */}
      {labels.map((label, i) => {
        const p = point(i, LEVELS);
        const clickable = !!onLabelPress;
        const yOff = p.y <= center ? -8 : 16;
        return (
          <text
            key={`label-${i}`}
            x={p.x}
            y={p.y + yOff}
            textAnchor="middle"
            fontSize="12"
            fill={clickable ? '#1D4ED8' : '#374151'}
            fontWeight="600"
            style={clickable ? { cursor: 'pointer' } : undefined}
            onClick={clickable ? () => onLabelPress!(label) : undefined}
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

export default function VocabularyPage() {
  const router = useSafeRouter();
  const [mode, setMode] = useState<'subject' | 'family' | 'major'>('subject');
  const [access, setAccess] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [selected, setSelected] = useState<string[]>(['物理', '化学', '生物']);
  const [collapsed, setCollapsed] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [history] = useState<LevelSnapshot[]>(() => loadHistory());
  const rec = recommendStudent(SUBJECT_LEVELS);

  // 能力图谱灰度开放：仅对指定用户开放，其他人不可用
  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithRetry('/api/v1/user/ability-graph/access');
        const data = await res.json();
        setAccess(data?.enabled ? 'allowed' : 'denied');
      } catch {
        setAccess('denied');
      }
    })();
  }, []);

  const toggleSubject = (subject: string) => {
    setSelected((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]
    );
  };

  const openSubjectRadar = (subject: string) => {
    router.push('/subject-radar', { subject });
  };

  if (access === 'checking') {
    return (
      <Screen>
        <View style={styles.gateContainer}>
          <ActivityIndicator color="#3B82F6" size="large" />
          <Text style={styles.gateText}>加载中…</Text>
        </View>
      </Screen>
    );
  }

  if (access === 'denied') {
    return (
      <Screen>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.backText}>← back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>能力图谱</Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.gateContainer}>
            <Text style={styles.gateText}>功能暂未开放</Text>
            <Text style={styles.gateSubText}>当前仅对指定用户开放，敬请期待</Text>
          </View>
        </View>
      </Screen>
    );
  }

  const selectedValues = selected.map((s) => SUBJECT_LEVELS[s] ?? 4);

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>能力图谱</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, mode === 'subject' && styles.tabActive]}
            onPress={() => setMode('subject')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, mode === 'subject' && styles.tabTextActive]}>学科</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, mode === 'family' && styles.tabActive]}
            onPress={() => setMode('family')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, mode === 'family' && styles.tabTextActive]}>家族</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, mode === 'major' && styles.tabActive]}
            onPress={() => setMode('major')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, mode === 'major' && styles.tabTextActive]}>专业推荐</Text>
          </TouchableOpacity>
        </View>

        {mode === 'subject' ? (
          <>
            <View style={styles.radarSection}>
              {selected.length >= 3 ? (
                <>
                  <View style={styles.radarWrap}>
                    <Radar labels={selected} values={selectedValues} onLabelPress={openSubjectRadar} />
                  </View>
                </>
              ) : (
                <Text style={styles.minTip}>至少选择 3 个学科即可生成能力雷达图（已选 {selected.length} 科，可继续点击学科添加/取消）</Text>
              )}
            </View>

            <View style={styles.grid}>
              {collapsed ? (
                <TouchableOpacity
                  style={styles.expandBtn}
                  activeOpacity={0.8}
                  onPress={() => setCollapsed(false)}
                >
                  <FontAwesome6 name="eye" size={16} color="#fff" />
                </TouchableOpacity>
              ) : (
                <>
                  <View style={styles.gridRow}>
                    {SUBJECTS.slice(0, 5).map((subject) => {
                      const isSelected = selected.includes(subject);
                      return (
                        <TouchableOpacity
                          key={subject}
                          style={[styles.subjectCard, isSelected ? styles.subjectSelected : styles.subjectDefault]}
                          activeOpacity={0.8}
                          onPress={() => toggleSubject(subject)}
                        >
                          <Text style={styles.subjectText}>{subject}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={styles.gridRow}>
                    {SUBJECTS.slice(5).map((subject) => {
                      const isSelected = selected.includes(subject);
                      return (
                        <TouchableOpacity
                          key={subject}
                          style={[styles.subjectCard, isSelected ? styles.subjectSelected : styles.subjectDefault]}
                          activeOpacity={0.8}
                          onPress={() => toggleSubject(subject)}
                        >
                          <Text style={styles.subjectText}>{subject}</Text>
                        </TouchableOpacity>
                      );
                    })}
                    <TouchableOpacity
                      style={styles.subjectHide}
                      activeOpacity={0.8}
                      onPress={() => setCollapsed(true)}
                    >
                      <FontAwesome6 name="eye" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </>
        ) : mode === 'major' ? (
          <View style={styles.familyContainer}>
            <View style={styles.radarWrap}>
              <Radar labels={[...ABILITY_IDS]} values={rec.ability} />
              <Text style={styles.radarHint}>你的能力家族：R01 推理与论证 · … · R10 自主学习与元认知</Text>
            </View>
            <Text style={styles.sectionTitle}>推荐学科门类（点击门类查看其全部二级学科匹配度）</Text>
            <View style={styles.list}>
              {rec.fields.map((f, i) => {
                const open = activeField === f.field;
                const specs = matchFieldSpecialties(SUBJECT_LEVELS, f.field);
                const hist = open ? specHistoryScores(history, f.field) : {};
                return (
                  <View key={f.field}>
                    <TouchableOpacity
                      style={[styles.fieldItem, i < 3 && styles.fieldTop]}
                      activeOpacity={0.7}
                      onPress={() => setActiveField(open ? null : f.field)}
                    >
                      <Text style={styles.fieldRank}>{i + 1}</Text>
                      <Text style={[styles.fieldName, i < 3 && styles.fieldNameTop]}>{f.field}</Text>
                      <Text style={styles.fieldScore}>{f.score}%</Text>
                      <Text style={styles.fieldCaret}>{open ? '▾' : '▸'}</Text>
                    </TouchableOpacity>
                    {open && (
                      <View style={styles.fieldSpecBox}>
                        {specs.length === 0 ? (
                          <Text style={styles.refinedEmpty}>该门类暂无二级学科数据（待扩充）</Text>
                        ) : (
                          specs.map((s, si) => {
                            const h = hist[s.name] || [];
                            const latest = h.length ? h[h.length - 1].score : s.score;
                            const prev = h.length > 1 ? h[h.length - 2].score : null;
                            const delta = prev == null ? null : latest - prev;
                            return (
                              <View key={s.name}>
                                <View style={[styles.fieldSpecRow, si === 0 && styles.fieldSpecBest]}>
                                  <Text style={styles.fieldSpecRank}>{si + 1}</Text>
                                  <Text style={styles.fieldSpecMajor}>{s.major}</Text>
                                  <Text style={styles.fieldSpecNameWrap}>
                                    <Text style={styles.refinedName}>{s.name}</Text>
                                    {h.length > 1 && (
                                      <Text style={styles.fieldSpecDelta}>
                                        {delta == null ? '' : delta >= 0 ? ` ▲${delta}%` : ` ▼${-delta}%`}
                                      </Text>
                                    )}
                                  </Text>
                                  <Text style={[styles.fieldScore, si === 0 && styles.fieldScoreBest]}>{latest}%</Text>
                                </View>
                                {h.length > 0 && (
                                  <View style={styles.fieldSpecHist}>
                                    <Text style={styles.fieldSpecHistLabel}>历史：</Text>
                                    {h.map((p, pi) => (
                                      <Text key={pi} style={styles.fieldSpecHistItem}>
                                        {fmtTime(p.t)} {p.score}%{pi < h.length - 1 ? ' · ' : ''}
                                      </Text>
                                    ))}
                                  </View>
                                )}
                              </View>
                            );
                          })
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.familyContainer}>
            <View style={styles.radarWrap}>
              <Radar labels={ABILITIES.map((a) => a.id)} values={ABILITIES.map((a) => a.level)} />
              <Text style={styles.radarHint}>能力共 6 级：L1 识记 · L2 理解 · L3 应用 · L4 分析 · L5 评价 · L6 创造</Text>
            </View>
            <View style={styles.list}>
              {ABILITIES.map((item, i) => (
                <View key={item.id} style={styles.listItem}>
                  <View style={[styles.dot, { backgroundColor: SUBJECT_COLORS[i % SUBJECT_COLORS.length] }]} />
                  <Text style={styles.idText}>{item.id}</Text>
                  <Text style={styles.nameText}>{item.name}</Text>
                  <Text style={styles.levelText}>L{item.level}</Text>
                </View>
              ))}
            </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#E5E5E5',
  },
  backText: {
    fontSize: 14,
    color: '#000000',
    fontFamily: 'serif',
  },
  title: {
    fontSize: 16,
    color: '#333333',
    fontFamily: 'serif',
    fontWeight: '600',
  },
  placeholder: {
    width: 50,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  gateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  gateText: {
    fontSize: 15,
    color: '#6B7280',
    fontFamily: 'serif',
  },
  gateSubText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'serif',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    color: '#4B5563',
    fontFamily: 'serif',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  grid: {
    alignItems: 'center',
    rowGap: 8,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 44,
  },
  gridRow: {
    flexDirection: 'row',
    columnGap: 8,
    justifyContent: 'center',
  },
  subjectCard: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontFamily: 'serif',
    fontWeight: '600',
  },
  subjectDefault: {
    backgroundColor: '#9CA3AF',
  },
  subjectSelected: {
    backgroundColor: '#22C55E',
  },
  subjectHide: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4B5563',
  },
  expandBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
  },
  radarSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'serif',
    marginTop: 18,
    marginBottom: 6,
    paddingHorizontal: 20,
  },
  minTip: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'serif',
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 32,
  },
  radarWrap: {
    alignItems: 'center',
  },
  radarHint: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
  familyContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  list: {
    flex: 1,
    width: '100%',
    marginTop: 16,
    paddingBottom: 24,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  fieldItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  fieldTop: {
    backgroundColor: '#F0FDF4',
  },
  fieldRank: {
    width: 24,
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  fieldName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  fieldNameTop: {
    color: '#15803D',
  },
  fieldScore: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  fieldCaret: {
    width: 20,
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  fieldSpecBox: {
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  fieldSpecRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 9,
  },
  fieldSpecBest: {
    backgroundColor: '#ECFDF5',
  },
  fieldSpecRank: {
    width: 22,
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  fieldSpecMajor: {
    width: 108,
    fontSize: 11,
    color: '#9CA3AF',
  },
  refinedName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  fieldSpecNameWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldSpecDelta: {
    marginLeft: 4,
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  fieldSpecHist: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 26,
    paddingBottom: 6,
    gap: 2,
  },
  fieldSpecHistLabel: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  fieldSpecHistItem: {
    fontSize: 11,
    color: '#6B7280',
  },
  fieldScoreBest: {
    color: '#059669',
  },
  refinedEmpty: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  idText: {
    width: 38,
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'serif',
  },
  nameText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    fontFamily: 'serif',
  },
  levelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
    fontFamily: 'serif',
  },
});