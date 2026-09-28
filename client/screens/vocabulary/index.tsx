import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { fetchWithRetry } from '@/utils/apiClient';

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
function Radar({ labels, values, color = '#3B82F6' }: { labels: string[]; values: number[]; color?: string }) {
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
        return (
          <text
            key={`label-${i}`}
            x={p.x}
            y={p.y + (p.y <= center ? -8 : 16)}
            textAnchor="middle"
            fontSize="12"
            fill="#374151"
            fontWeight="600"
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
  const [mode, setMode] = useState<'subject' | 'family'>('subject');
  const [access, setAccess] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [selected, setSelected] = useState<string[]>(['物理', '化学', '生物']);

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
        </View>

        {mode === 'subject' ? (
          <>
            <View style={styles.radarSection}>
              {selected.length >= 3 ? (
                <>
                  <View style={styles.radarWrap}>
                    <Radar labels={selected} values={selectedValues} />
                  </View>
                </>
              ) : (
                <Text style={styles.minTip}>至少选择 3 个学科即可生成能力雷达图（已选 {selected.length} 科，可继续点击学科添加/取消）</Text>
              )}
            </View>

            <View style={styles.grid}>
              {SUBJECTS.map((subject) => {
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
          </>
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 16,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 44,
  },
  subjectCard: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectText: {
    fontSize: 13,
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
  radarSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    color: '#374151',
    fontFamily: 'serif',
    marginBottom: 12,
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