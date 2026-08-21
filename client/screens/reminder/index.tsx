import { View, Text, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { getApiBaseUrl } from '@/utils/apiConfig';
import { useAuth } from '@/contexts/AuthContext';

interface Reminder {
  id: string;
  time: string;
  enabled: boolean;
  title: string;
  message: string;
}

export default function ReminderScreen() {
  const router = useSafeRouter();
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([
    { id: '1', time: '08:00', enabled: true, title: '晨间学习', message: '新的一天，开始学习吧！' },
    { id: '2', time: '12:30', enabled: false, title: '午间复习', message: '午休时间，复习一下上午学的内容' },
    { id: '3', time: '20:00', enabled: true, title: '晚间学习', message: '晚上是学习的好时光' },
    { id: '4', time: '21:30', enabled: false, title: '睡前复习', message: '睡前复习，巩固记忆' },
  ]);
  const [globalEnabled, setGlobalEnabled] = useState(true);

  const toggleReminder = (id: string) => {
    setReminders(prev => prev.map(r => 
      r.id === id ? { ...r, enabled: !r.enabled } : r
    ));
  };

  const toggleGlobal = () => {
    setGlobalEnabled(!globalEnabled);
  };

  const addReminder = () => {
    Alert.prompt(
      '添加提醒',
      '请输入提醒时间（格式：HH:MM）',
      (time) => {
        if (time && /^\d{2}:\d{2}$/.test(time)) {
          setReminders(prev => [...prev, {
            id: Date.now().toString(),
            time,
            enabled: true,
            title: '学习提醒',
            message: '该学习啦！',
          }]);
        } else if (time) {
          Alert.alert('错误', '请输入正确的时间格式，如 09:00');
        }
      },
      'plain-text',
      '09:00'
    );
  };

  const deleteReminder = (id: string) => {
    Alert.alert(
      '删除提醒',
      '确定要删除这个提醒吗？',
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '删除', 
          style: 'destructive',
          onPress: () => {
            setReminders(prev => prev.filter(r => r.id !== id));
          }
        },
      ]
    );
  };

  return (
    <Screen title="学习提醒">
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
        {/* 总开关 */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Ionicons name="notifications" size={24} color="#3b82f6" />
            <Text className="text-gray-900 font-bold ml-3">学习提醒</Text>
          </View>
          <Switch
            value={globalEnabled}
            onValueChange={toggleGlobal}
            trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
            thumbColor={globalEnabled ? '#3b82f6' : '#f4f3f4'}
          />
        </View>

        {/* 提醒列表 */}
        <View className="bg-white rounded-2xl mb-4 shadow-sm overflow-hidden">
          <View className="flex-row items-center justify-between p-4 border-b border-gray-100">
            <Text className="text-lg font-bold text-gray-900">提醒时间</Text>
            <TouchableOpacity 
              className="bg-blue-500 rounded-full px-4 py-2 flex-row items-center"
              onPress={addReminder}
            >
              <Ionicons name="add" size={20} color="white" />
              <Text className="text-white font-medium ml-1">添加</Text>
            </TouchableOpacity>
          </View>

          {reminders.map((reminder) => (
            <View 
              key={reminder.id}
              className={`flex-row items-center justify-between p-4 border-b border-gray-100 ${
                !globalEnabled || !reminder.enabled ? 'opacity-50' : ''
              }`}
            >
              <View className="flex-row items-center flex-1">
                <View className="bg-blue-100 rounded-full w-12 h-12 items-center justify-center mr-4">
                  <Text className="text-blue-600 font-bold text-lg">{reminder.time}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-gray-900 font-medium">{reminder.title}</Text>
                  <Text className="text-gray-500 text-sm">{reminder.message}</Text>
                </View>
              </View>
              <View className="flex-row items-center">
                <Switch
                  value={reminder.enabled}
                  onValueChange={() => toggleReminder(reminder.id)}
                  disabled={!globalEnabled}
                  trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
                  thumbColor={reminder.enabled ? '#3b82f6' : '#f4f3f4'}
                />
                <TouchableOpacity 
                  className="ml-3 p-2"
                  onPress={() => deleteReminder(reminder.id)}
                >
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* 提醒设置 */}
        <View className="bg-white rounded-2xl p-4 shadow-sm">
          <Text className="text-lg font-bold text-gray-900 mb-4">提醒设置</Text>
          
          <View className="space-y-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-gray-700">提醒方式</Text>
              <Text className="text-gray-500">应用内通知</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-gray-700">重复</Text>
              <Text className="text-gray-500">每天</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-gray-700">免打扰时段</Text>
              <TouchableOpacity>
                <Text className="text-blue-500">设置</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 提示信息 */}
        <View className="bg-blue-50 rounded-2xl p-4 mt-4">
          <View className="flex-row items-start">
            <Ionicons name="information-circle" size={20} color="#3b82f6" className="mt-0.5" />
            <Text className="text-blue-700 text-sm ml-2 flex-1">
              开启学习提醒后，系统会在设定时间提醒您学习。建议每天保持固定的学习时间，养成良好的学习习惯。
            </Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
