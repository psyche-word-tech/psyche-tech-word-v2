import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';

const backgroundImg = require('@/assets/home-bg.jpg');
const booksIcon = require('@/assets/books-icon.webp');

export default function HomeScreen() {
  const router = useSafeRouter();

  return (
    <Screen>
      <ScrollView style={styles.container} bounces={false}>
        {/* Top Background Image Area */}
        <View style={styles.topSection}>
          <Image 
            source={backgroundImg} 
            style={styles.backgroundImage}
            resizeMode="cover"
          />
          {/* Search Icon - Top Right */}
          <TouchableOpacity 
            style={styles.searchButton}
            activeOpacity={0.7}
            onPress={() => router.push('/search')}
          >
            <Ionicons name="search" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          {/* Essay Grading Icon - Top Left */}
          <TouchableOpacity 
            style={styles.essayButton}
            activeOpacity={0.7}
            onPress={() => router.push('/essay-grading')}
          >
            <Ionicons name="create-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.imageOverlay}>
            <Text style={styles.imageLabel}>刻字</Text>
          </View>
        </View>

        {/* Bottom Section - 2x2 Grid */}
        <View style={styles.gridContainer}>
          <View style={styles.gridRow}>
            {/* Top Left - Study */}
            <TouchableOpacity 
              style={[styles.gridCell, styles.cellBrown]}
              activeOpacity={0.8}
              onPress={() => router.push('/study')}
            >
              <View style={styles.iconCard}>
                <Ionicons name="home-outline" size={40} color="#333" />
              </View>
            </TouchableOpacity>

            {/* Top Right - Calendar */}
            <TouchableOpacity 
              style={[styles.gridCell, styles.cellGray]}
              activeOpacity={0.8}
              onPress={() => router.push('/calendar')}
            >
              <View style={styles.iconCard}>
                <Ionicons name="calendar-outline" size={40} color="#333" />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.gridRow}>
            {/* Bottom Left - Settings (no icon, keep link) */}
            <TouchableOpacity 
              style={[styles.gridCell, styles.cellDark]}
              activeOpacity={0.8}
              onPress={() => router.push('/settings')}
            >
              {/* Icon removed, link preserved */}
            </TouchableOpacity>

            {/* Bottom Right - My Vocabulary Books */}
            <TouchableOpacity 
              style={[styles.gridCell, styles.cellBrownDark]}
              activeOpacity={0.8}
              onPress={() => router.push('/study')}
            >
              <Image 
                source={booksIcon}
                style={styles.iconImage}
                resizeMode="contain"
              />
              <Text style={styles.cardText}>我的词汇书</Text>
            </TouchableOpacity>
          </View>
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
    position: 'relative',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  imageLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'serif',
    fontWeight: '300',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  searchButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  essayButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridContainer: {
    flex: 1,
  },
  gridRow: {
    flexDirection: 'row',
    height: 200,
  },
  gridCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellBrown: {
    backgroundColor: '#5D3A1A',
  },
  cellGray: {
    backgroundColor: '#6B5B4F',
  },
  cellDark: {
    backgroundColor: '#4A3728',
  },
  cellBrownDark: {
    backgroundColor: '#4A2E0F',
  },
  iconCard: {
    backgroundColor: '#F5F5F5',
    padding: 20,
    borderRadius: 4,
  },
  iconImage: {
    width: 60,
    height: 60,
  },
  cardText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'serif',
    marginTop: 8,
    letterSpacing: 2,
  },
});
