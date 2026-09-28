import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';

const SUBJECTS = ['语文', '数学', '外语', '物理', '化学', '生物', '政治', '历史', '地理'];
const SUBJECT_COLORS = [
  '#EF5350', '#42A5F5', '#66BB6A', '#FFA726',
  '#AB47BC', '#26C6DA', '#EF5350', '#FF7043', '#8D6E63',
];

export default function VocabularyPage() {
  const router = useSafeRouter();
  const [mode, setMode] = useState<'subject' | 'family'>('subject');

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

        {/* 检索方式切换 */}
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
          <View style={styles.grid}>
            {SUBJECTS.map((subject, index) => (
              <TouchableOpacity
                key={subject}
                style={[styles.subjectCard, { backgroundColor: SUBJECT_COLORS[index] }]}
                activeOpacity={0.8}
              >
                <Text style={styles.subjectText}>{subject}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>家族检索建设中</Text>
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
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 12,
  },
  subjectCard: {
    width: '30%',
    aspectRatio: 1.4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'serif',
    fontWeight: '600',
  },
  empty: {
    padding: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontFamily: 'serif',
  },
});