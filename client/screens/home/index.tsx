import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity } from 'react-native';
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
          <View style={styles.imageOverlay}>
            <Text style={styles.imageLabel}>刻字</Text>
          </View>
        </View>

        {/* Bottom Section - My Vocabulary Books */}
        <View style={styles.bottomSection}>
          <TouchableOpacity 
            style={styles.card}
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
  bottomSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  card: {
    alignItems: 'center',
    padding: 20,
  },
  iconImage: {
    width: 120,
    height: 120,
  },
  cardText: {
    fontSize: 18,
    color: '#333333',
    fontFamily: 'serif',
    marginTop: 16,
    letterSpacing: 2,
  },
});
