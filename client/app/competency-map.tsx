import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const RADAR_SIZE = Math.min(SCREEN_WIDTH - 60, 350);

// 雷达图数据
const RADAR_DATA = [
  { label: '代数', value: 0.85 },
  { label: '几何', value: 0.72 },
  { label: '概率', value: 0.68 },
  { label: '统计', value: 0.75 },
  { label: '函数', value: 0.80 },
  { label: '数列', value: 0.65 },
];

// 绘制雷达图 SVG
const RadarChart = ({ size }: { size: number }) => {
  const center = size / 2;
  const levels = 5;
  const angleStep = (Math.PI * 2) / RADAR_DATA.length;

  // 计算多边形点
  const getPolygonPoints = (level: number) => {
    const radius = (size / 2) * (level / levels) * 0.85;
    return RADAR_DATA.map((_, i) => {
      const angle = angleStep * i - Math.PI / 2;
      const x = center + radius * Math.cos(angle);
      const y = center + radius * Math.sin(angle);
      return `${x},${y}`;
    }).join(' ');
  };

  // 计算数据点
  const getDataPoints = () => {
    return RADAR_DATA.map((item, i) => {
      const angle = angleStep * i - Math.PI / 2;
      const radius = (size / 2) * item.value * 0.85;
      const x = center + radius * Math.cos(angle);
      const y = center + radius * Math.sin(angle);
      return `${x},${y}`;
    }).join(' ');
  };

  // 计算标签位置
  const getLabelPosition = (index: number) => {
    const angle = angleStep * index - Math.PI / 2;
    const radius = (size / 2) * 0.95;
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    return { x, y };
  };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* 背景网格 */}
      {Array.from({ length: levels }, (_, i) => (
        <polygon
          key={`grid-${i}`}
          points={getPolygonPoints(i + 1)}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="1"
        />
      ))}

      {/* 放射线 */}
      {RADAR_DATA.map((_, i) => {
        const angle = angleStep * i - Math.PI / 2;
        const radius = (size / 2) * 0.85;
        const x = center + radius * Math.cos(angle);
        const y = center + radius * Math.sin(angle);
        return (
          <line
            key={`line-${i}`}
            x1={center}
            y1={center}
            x2={x}
            y2={y}
            stroke="#E5E7EB"
            strokeWidth="1"
          />
        );
      })}

      {/* 数据区域 */}
      <polygon
        points={getDataPoints()}
        fill="rgba(59, 130, 246, 0.3)"
        stroke="#3B82F6"
        strokeWidth="2"
      />

      {/* 数据点 */}
      {RADAR_DATA.map((item, i) => {
        const angle = angleStep * i - Math.PI / 2;
        const radius = (size / 2) * item.value * 0.85;
        const x = center + radius * Math.cos(angle);
        const y = center + radius * Math.sin(angle);
        return (
          <circle
            key={`point-${i}`}
            cx={x}
            cy={y}
            r="4"
            fill="#3B82F6"
          />
        );
      })}

      {/* 标签 */}
      {RADAR_DATA.map((item, i) => {
        const pos = getLabelPosition(i);
        return (
          <text
            key={`label-${i}`}
            x={pos.x}
            y={pos.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="12"
            fill="#374151"
            fontWeight="500"
          >
            {item.label}
          </text>
        );
      })}
    </svg>
  );
};

export default function CompetencyMapScreen() {
  const router = useSafeRouter();

  return (
    <Screen>
      <View style={styles.container}>
        {/* 顶部导航栏 */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace('/')}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>能力雷达</Text>
          <View style={styles.placeholder} />
        </View>

        {/* 雷达图区域 */}
        <View style={styles.chartContainer}>
          <RadarChart size={RADAR_SIZE} />
        </View>

        {/* 数据图例 */}
        <View style={styles.legendContainer}>
          {RADAR_DATA.map((item, index) => (
            <View key={index} style={styles.legendItem}>
              <View style={styles.legendDot} />
              <Text style={styles.legendLabel}>{item.label}</Text>
              <Text style={styles.legendValue}>{Math.round(item.value * 100)}%</Text>
            </View>
          ))}
        </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  chartContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  legendContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3B82F6',
    marginRight: 12,
  },
  legendLabel: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
  },
  legendValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
});
