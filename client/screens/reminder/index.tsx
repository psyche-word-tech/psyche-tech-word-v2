import { View, Text, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';

export default function ReminderScreen() {
  const [dailyReminder, setDailyReminder] = useState(true);
  const [reminderTime, setReminderTime] = useState('09:00');
  const [weeklyReport, setWeeklyReport] = useState(true);
  const [achievementNotify, setAchievementNotify] = useState(true);

  const timeSlots = ['08:00', '09:00', '10:00', '12:00', '14:00', '18:00', '20:00', '21:00'];

  return (
    <Screen>
      <Header title="学习提醒" />
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
        {/* 每日提醒 */}
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: '#dbeafe',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Ionicons name="alarm" size={20} color="#3b82f6" />
              </View>
              <View>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#1f2937' }}>每日学习提醒</Text>
                <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>每天定时提醒学习</Text>
              </View>
            </View>
            <Switch
              value={dailyReminder}
              onValueChange={setDailyReminder}
              trackColor={{ false: '#e5e7eb', true: '#bfdbfe' }}
              thumbColor={dailyReminder ? '#3b82f6' : '#9ca3af'}
            />
          </View>

          {dailyReminder && (
            <View>
              <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 12 }}>选择提醒时间</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {timeSlots.map((time) => (
                  <TouchableOpacity
                    key={time}
                    onPress={() => setReminderTime(time)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor: reminderTime === time ? '#3b82f6' : '#f3f4f6',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        color: reminderTime === time ? '#fff' : '#4b5563',
                        fontWeight: reminderTime === time ? '600' : '400',
                      }}
                    >
                      {time}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* 通知设置 */}
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            overflow: 'hidden',
            marginBottom: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: '#f3f4f6',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: '#fef3c7',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Ionicons name="stats-chart" size={20} color="#f59e0b" />
              </View>
              <View>
                <Text style={{ fontSize: 15, color: '#1f2937' }}>每周学习报告</Text>
                <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>每周一发送学习总结</Text>
              </View>
            </View>
            <Switch
              value={weeklyReport}
              onValueChange={setWeeklyReport}
              trackColor={{ false: '#e5e7eb', true: '#fef3c7' }}
              thumbColor={weeklyReport ? '#f59e0b' : '#9ca3af'}
            />
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: '#d1fae5',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Ionicons name="trophy" size={20} color="#10b981" />
              </View>
              <View>
                <Text style={{ fontSize: 15, color: '#1f2937' }}>成就通知</Text>
                <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>解锁成就时通知</Text>
              </View>
            </View>
            <Switch
              value={achievementNotify}
              onValueChange={setAchievementNotify}
              trackColor={{ false: '#e5e7eb', true: '#d1fae5' }}
              thumbColor={achievementNotify ? '#10b981' : '#9ca3af'}
            />
          </View>
        </View>

        {/* 提示 */}
        <View
          style={{
            backgroundColor: '#eff6ff',
            borderRadius: 12,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'flex-start',
          }}
        >
          <Ionicons name="information-circle" size={20} color="#3b82f6" style={{ marginRight: 8, marginTop: 2 }} />
          <Text style={{ fontSize: 13, color: '#1e40af', flex: 1 }}>
            开启提醒后，系统会在设定时间推送学习提醒，帮助你保持学习习惯。
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
