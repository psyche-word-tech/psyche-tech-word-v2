import { View, Text, ScrollView, TouchableOpacity, Switch, Slider } from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';

export default function DisplaySettingsScreen() {
  const router = useSafeRouter();
  const [fontSize, setFontSize] = useState(16);
  const [darkMode, setDarkMode] = useState(false);
  const [autoPlayAudio, setAutoPlayAudio] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);
  const [showPhonetic, setShowPhonetic] = useState(true);
  const [showExample, setShowExample] = useState(true);

  const fontSizes = [
    { label: '小', value: 14 },
    { label: '标准', value: 16 },
    { label: '大', value: 18 },
    { label: '超大', value: 20 },
  ];

  return (
    <Screen title="显示设置">
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
        {/* 字体大小 */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <Text className="text-lg font-bold text-gray-900 mb-4">字体大小</Text>
          
          <View className="flex-row justify-between mb-4">
            {fontSizes.map((size) => (
              <TouchableOpacity
                key={size.value}
                className={`flex-1 items-center py-3 rounded-xl mx-1 ${
                  fontSize === size.value ? 'bg-blue-500' : 'bg-gray-100'
                }`}
                onPress={() => setFontSize(size.value)}
              >
                <Text className={`font-medium ${
                  fontSize === size.value ? 'text-white' : 'text-gray-700'
                }`}>
                  {size.label}
                </Text>
                <Text className={`text-xs mt-1 ${
                  fontSize === size.value ? 'text-white/80' : 'text-gray-500'
                }`}>
                  {size.value}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 预览 */}
          <View className="bg-gray-50 rounded-xl p-4">
            <Text className="text-gray-900" style={{ fontSize }}>
              这是字体大小预览文本。English Word Preview.
            </Text>
          </View>
        </View>

        {/* 主题设置 */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <Text className="text-lg font-bold text-gray-900 mb-4">主题设置</Text>
          
          <View className="flex-row items-center justify-between py-3 border-b border-gray-100">
            <View className="flex-row items-center">
              <Ionicons name="moon" size={24} color="#6b7280" />
              <Text className="text-gray-700 ml-3">深色模式</Text>
            </View>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
              thumbColor={darkMode ? '#3b82f6' : '#f4f3f4'}
            />
          </View>

          <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center">
              <Ionicons name="color-palette" size={24} color="#6b7280" />
              <Text className="text-gray-700 ml-3">跟随系统</Text>
            </View>
            <Switch
              value={true}
              trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
              thumbColor={'#3b82f6'}
            />
          </View>
        </View>

        {/* 学习内容显示 */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <Text className="text-lg font-bold text-gray-900 mb-4">学习内容显示</Text>
          
          <View className="flex-row items-center justify-between py-3 border-b border-gray-100">
            <View className="flex-row items-center">
              <Ionicons name="volume-high" size={24} color="#6b7280" />
              <Text className="text-gray-700 ml-3">自动播放发音</Text>
            </View>
            <Switch
              value={autoPlayAudio}
              onValueChange={setAutoPlayAudio}
              trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
              thumbColor={autoPlayAudio ? '#3b82f6' : '#f4f3f4'}
            />
          </View>

          <View className="flex-row items-center justify-between py-3 border-b border-gray-100">
            <View className="flex-row items-center">
              <Ionicons name="translate" size={24} color="#6b7280" />
              <Text className="text-gray-700 ml-3">显示中文释义</Text>
            </View>
            <Switch
              value={showTranslation}
              onValueChange={setShowTranslation}
              trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
              thumbColor={showTranslation ? '#3b82f6' : '#f4f3f4'}
            />
          </View>

          <View className="flex-row items-center justify-between py-3 border-b border-gray-100">
            <View className="flex-row items-center">
              <Ionicons name="text" size={24} color="#6b7280" />
              <Text className="text-gray-700 ml-3">显示音标</Text>
            </View>
            <Switch
              value={showPhonetic}
              onValueChange={setShowPhonetic}
              trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
              thumbColor={showPhonetic ? '#3b82f6' : '#f4f3f4'}
            />
          </View>

          <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center">
              <Ionicons name="list" size={24} color="#6b7280" />
              <Text className="text-gray-700 ml-3">显示例句</Text>
            </View>
            <Switch
              value={showExample}
              onValueChange={setShowExample}
              trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
              thumbColor={showExample ? '#3b82f6' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* 其他设置 */}
        <View className="bg-white rounded-2xl p-4 shadow-sm">
          <Text className="text-lg font-bold text-gray-900 mb-4">其他设置</Text>
          
          <TouchableOpacity className="flex-row items-center justify-between py-3 border-b border-gray-100">
            <View className="flex-row items-center">
              <Ionicons name="refresh" size={24} color="#6b7280" />
              <Text className="text-gray-700 ml-3">每日新词数量</Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-gray-500 mr-2">20 个</Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center">
              <Ionicons name="repeat" size={24} color="#6b7280" />
              <Text className="text-gray-700 ml-3">每日复习数量</Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-gray-500 mr-2">100 个</Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Screen>
  );
}
