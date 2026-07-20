import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';

export default function HomeScreen() {
  const router = useSafeRouter();

  return (
    <Screen>
      <ScrollView style={styles.container} bounces={false}>
        {/* Top Section - Brand Name */}
        <View style={styles.topSection}>
          <Text style={styles.brandText}>psyche tech</Text>
          <Text style={styles.subText}>刻字</Text>
        </View>

        {/* Bottom Section - Navigation */}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => router.push('/study')}
          >
            <Text style={styles.cardText}>我的词汇书</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topSection: {
    height: 280,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandText: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  subText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 12,
    letterSpacing: 4,
  },
  bottomSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  card: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 40,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
  },
  cardText: {
    fontSize: 18,
    color: '#333333',
    fontWeight: '500',
    letterSpacing: 2,
  },
});
