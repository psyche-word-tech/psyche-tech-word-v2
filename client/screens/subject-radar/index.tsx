import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';

const RADAR_SIZE = Math.min(336, 320);
const LEVELS = 6;

// 各学科当前能力等级（1-6，后续可接诊断数据替换此演示模型）
const SUBJECT_LEVELS: Record<string, number> = {
  语文: 5, 数学: 5, 外语: 4, 物理: 4, 化学: 4, 生物: 4, 政治: 4, 历史: 3, 地理: 3,
};

// 各学科知识点大类（参考课标与常见考纲分层）
const SUBJECT_KNOWLEDGE: Record<string, string[]> = {
  语文: ['基础知识与积累', '现代文阅读', '古诗文阅读', '写作表达', '名著阅读与综合运用'],
  数学: ['数与代数', '图形与几何', '统计与概率', '函数与分析', '综合与实践'],
  外语: ['语音与词汇', '语法', '阅读理解', '书面表达', '听力与口语', '完形填空'],
  物理: ['力学', '热学', '电磁学', '光学', '声学', '原子与近代物理', '实验与科学探究'],
  化学: ['物质的组成与结构', '化学反应与能量', '元素及其化合物', '有机化学基础', '化学实验', '化学计算'],
  生物: ['分子与细胞', '遗传与进化', '稳态与调节', '生物与环境', '生物技术与工程'],
  政治: ['经济与社会', '政治与法治', '哲学与文化', '法律与生活', '当代国际政治与经济', '时事热点与价值观'],
  历史: ['中国古代史', '中国近代史', '中国现代史', '世界古代史', '世界近代史', '世界现代史'],
  地理: ['自然地理', '人文地理', '区域地理', '地理信息技术与读图能力'],
};

// 由学科整体等级派生各知识点大类等级的确定性分布（演示模型，可替换为真实诊断数据）
function kpLevels(subject: string, count: number): number[] {
  const base = SUBJECT_LEVELS[subject] ?? 4;
  const off = [0, 1, -1, 0, 1, -1, 0, 1, -1, 0, 1, -1, 0, 1];
  return Array.from({ length: count }, (_, i) => Math.max(1, Math.min(6, base + (off[i % off.length] ?? 0))));
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
          <text key={`l-${i}`} x={p.x} y={p.y + (p.y <= center ? -10 : 18)} textAnchor="middle" fontSize="9" fill="#374151" fontWeight="600">
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
  const knowledge = SUBJECT_KNOWLEDGE[name] ?? [];
  const values = kpLevels(name, knowledge.length || 1);

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

        {knowledge.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>暂无该学科的知识点分类</Text>
          </View>
        ) : (
          <>
            <View style={styles.body}>
              <Radar labels={knowledge} values={values} />
              <Text style={styles.hint}>能力共 {LEVELS} 级：L1 识记 · L2 理解 · L3 应用 · L4 分析 · L5 评价 · L6 创造</Text>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
              {knowledge.map((kp, i) => (
                <View key={kp} style={styles.listItem}>
                  <Text style={[styles.kpIndex, { backgroundColor: KP_COLORS[i % KP_COLORS.length] }]}>{i + 1}</Text>
                  <Text style={styles.nameText}>{kp}</Text>
                  <Text style={styles.levelText}>L{values[i]}</Text>
                </View>
              ))}
            </ScrollView>
          </>
        )}
      </View>
    </Screen>
  );
}

const KP_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

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
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, color: '#9CA3AF' },
  body: { alignItems: 'center', paddingTop: 24 },
  hint: { marginTop: 12, fontSize: 11, color: '#9CA3AF' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  kpIndex: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 12,
    textAlign: 'center',
    lineHeight: 20,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
  },
  nameText: { flex: 1, fontSize: 13, color: '#333333' },
  levelText: { fontSize: 13, color: '#3B82F6', fontWeight: '700' },
});