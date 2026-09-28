import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';

const RADAR_SIZE = Math.min(336, 320);

// 十个能力家族 R01-R10（能力共 6 级 L1-L6）
const ABILITIES = [
  { id: 'R01', name: '推理与论证' },
  { id: 'R02', name: '批判性思维与创新' },
  { id: 'R03', name: '证据与实证' },
  { id: 'R04', name: '模型建构与抽象' },
  { id: 'R05', name: '实验探究' },
  { id: 'R06', name: '信息处理与量化' },
  { id: 'R07', name: '表达与交流' },
  { id: 'R08', name: '价值判断与社会责任' },
  { id: 'R09', name: '文化理解与传承' },
  { id: 'R10', name: '自主学习与元认知' },
];

const LEVELS = 6;

// 各学科当前能力等级（1-6，后续可接诊断数据替换此演示模型）
const SUBJECT_LEVELS: Record<string, number> = {
  语文: 5, 数学: 5, 外语: 4, 物理: 4, 化学: 4, 生物: 4, 政治: 4, 历史: 3, 地理: 3,
};

// 由学科整体等级派生十个能力等级的确定性分布（演示模型，可替换为真实诊断数据）
function abilityLevels(subject: string): number[] {
  const base = SUBJECT_LEVELS[subject] ?? 4;
  const off = [0, 1, -1, 0, 1, -1, 0, 1, -1, 0];
  return off.map((d) => Math.max(1, Math.min(6, base + d)));
}

function Radar({ labels, values }: { labels: string[]; values: number[] }) {
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
    values.map((_, i) => { const p = point(i, level); return `${p.x},${p.y}`; }).join(' ');
  const dataPoints = () =>
    values.map((_, i) => { const p = point(i, values[i]); return `${p.x},${p.y}`; }).join(' ');

  return (
    <svg width={RADAR_SIZE} height={RADAR_SIZE} viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}>
      {Array.from({ length: LEVELS }, (_, i) => (
        <polygon key={`g-${i}`} points={polygonPoints(i + 1)} fill="none" stroke="#E5E7EB" strokeWidth={i === LEVELS - 1 ? 1.5 : 1} />
      ))}
      {values.map((_, i) => {
        const p = point(i, LEVELS);
        return <line key={`a-${i}`} x1={center} y1={center} x2={p.x} y2={p.y} stroke="#E5E7EB" strokeWidth="1" />;
      })}
      <polygon points={dataPoints()} fill="rgba(59,130,246,0.25)" stroke="#3B82F6" strokeWidth="2" />
      {values.map((_, i) => (
        <circle key={`d-${i}`} cx={point(i, values[i]).x} cy={point(i, values[i]).y} r="4" fill="#3B82F6" />
      ))}
      {labels.map((label, i) => {
        const p = point(i, LEVELS);
        return (
          <text key={`l-${i}`} x={p.x} y={p.y + (p.y <= center ? -8 : 16)} textAnchor="middle" fontSize="11" fill="#374151" fontWeight="600">
            {label}
          </text>
        );
      })}
    </svg>
  );
}

export default function SubjectRadarPage() {
  const router = useSafeRouter();
  const { subject } = useSafeSearchParams<{ subject?: string }>();
  const name = subject || '';
  const values = abilityLevels(name);

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{name}</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.body}>
          <Radar labels={ABILITIES.map((a) => a.id)} values={values} />
          <Text style={styles.hint}>能力共 6 级：L1 识记 · L2 理解 · L3 应用 · L4 分析 · L5 评价 · L6 创造</Text>
        </View>

        <View style={styles.list}>
          {ABILITIES.map((item, i) => (
            <View key={item.id} style={styles.listItem}>
              <View style={[styles.dot, { backgroundColor: COLORS[i % COLORS.length] }]} />
              <Text style={styles.idText}>{item.id}</Text>
              <Text style={styles.nameText}>{item.name}</Text>
              <Text style={styles.levelText}>L{values[i]}</Text>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const COLORS = ['#EF5350', '#42A5F5', '#66BB6A', '#FFA726', '#AB47BC', '#26C6DA', '#EC407A', '#FF7043', '#8D6E63', '#5C6BC0'];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#E5E5E5',
  },
  backText: { fontSize: 14, color: '#000000', fontFamily: 'serif' },
  title: { fontSize: 16, color: '#333333', fontFamily: 'serif', fontWeight: '600' },
  placeholder: { width: 50 },
  body: { alignItems: 'center', paddingTop: 24 },
  hint: { marginTop: 12, fontSize: 11, color: '#9CA3AF' },
  list: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  idText: { width: 40, fontSize: 12, color: '#666666', fontWeight: '600' },
  nameText: { flex: 1, fontSize: 13, color: '#333333' },
  levelText: { fontSize: 13, color: '#3B82F6', fontWeight: '700' },
});