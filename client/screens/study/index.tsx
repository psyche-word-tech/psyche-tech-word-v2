import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';

const iconRock = require('@/assets/iconRock.png');
const iconMyVocab = require('@/assets/my-vocab.png');
const region4Bg = require('@/assets/region4-bg.webp');
const regionAImg = require('@/assets/region-a.webp');
const regionBImg = require('@/assets/region-b.webp');

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HALF_HEIGHT = SCREEN_HEIGHT / 2; // 一半高度

export default function StudyScreen() {
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ engravedText?: string }>();
  const engravedText = params.engravedText || '';

  return (
    <Screen safeAreaEdges={[]}>
      <View style={styles.container}>
        {/* 上半部分：区域一（100% 宽，50% 高） */}
        <TouchableOpacity 
          style={styles.topCard} 
          activeOpacity={0.9} 
          onPress={() => router.push('/engrave')}
        >
          <Image source={iconRock} style={styles.topImage} resizeMode="stretch" />
          {engravedText.length > 0 && (
            <View style={[styles.engravedTextContainer, { position: 'absolute', top: HALF_HEIGHT / 3 + 55, flexDirection: 'column', alignItems: 'center' }]}>
              {engravedText.split(' ').map((word, wordIndex) => (
                <View key={wordIndex} style={{ flexDirection: 'row', marginVertical: 5 }}>
                  {word.split('').map((char, charIndex) => (
                    <View key={charIndex} style={{ marginHorizontal: 15 }}>
                      <Text style={styles.engravedText}>{char}</Text>
                      <Text style={styles.engravedTextHighlight}>{char}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}
        </TouchableOpacity>

        {/* 下半部分：2x2 田字格（区域二、三、四、五） */}
        <View style={styles.bottomSection}>
          {/* 上一行：区域二（左右分栏：区域a、区域b） */}
          <View style={styles.bottomRow}>
            <TouchableOpacity 
              style={styles.gridItem} 
              activeOpacity={0.9} 
              onPress={() => router.push('/vocabulary')}
            >
              <Image source={regionAImg} style={styles.regionAStyle} resizeMode="stretch" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.gridItem} 
              activeOpacity={0.9} 
              onPress={() => router.push('/calendar')}
            >
              <Image source={regionBImg} style={styles.regionAStyle} resizeMode="stretch" />
            </TouchableOpacity>
          </View>
          {/* 下一行：区域四、区域五 */}
          <View style={styles.bottomRow}>
            <TouchableOpacity 
              style={styles.gridItem}
              activeOpacity={0.9}
              onPress={() => router.push('/login')}
            >
              <Image source={region4Bg} style={styles.gridImageFull} resizeMode="cover" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.gridItem, { borderWidth: 0 }]} 
              activeOpacity={0.9} 
              onPress={() => router.push('/my-vocabulary')}
            >
              <Image source={iconMyVocab} style={styles.gridImageFull} resizeMode="stretch" />
              <View style={[styles.labelContainer, { marginTop: -10 }]}>
                <Text style={styles.gridLabel}>我的词汇书</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // 文字在区域下方居中
  labelContainer: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topCard: {
    height: HALF_HEIGHT,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topImage: {
    width: '100%',
    height: '100%',
    marginTop: 50,
  },
  topLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  // 下半部分：2x2 排列（区域二、三、四、五）
  bottomSection: {
    height: HALF_HEIGHT,
    width: '100%',
  },
  gridRow: {
    flex: 1,
    flexDirection: 'row',
  },
  bottomRow: {
    height: 177,
    flexDirection: 'row',
  },
  gridItem: {
    flex: 1,
  },
  regionAStyle: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  gridImageFull: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  region4Image: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  dangImage: {
    width: 160,
    height: 160,
    marginLeft: -20,
    marginTop: -1,
  },
  gridLabel: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '600',
  },
  emptyCard: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridIcon: {
    width: 48,
    height: 48,
  },
  engravedTextContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  engravedWordColumn: {
    flexDirection: 'column',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  engravedCharWrapper: {
    position: 'relative',
  },
  // 刻字主体
  engravedText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  // 高光层
  engravedTextHighlight: {
    position: 'absolute',
    top: -0.5,
    left: -0.5,
    fontSize: 20,
    fontWeight: 'bold',
    color: 'rgba(255,255,255,0.9)',
  },
});
