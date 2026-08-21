import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput, Modal } from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { getApiBaseUrl } from '@/utils/apiConfig';

export default function AccountSettingsScreen() {
  const router = useSafeRouter();
  const { user, updateUserInfo } = useAuth();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showChangePhone, setShowChangePhone] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      Alert.alert('错误', '两次输入的密码不一致');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('错误', '密码长度至少 6 位');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`,
        },
        body: JSON.stringify({
          oldPassword,
          newPassword,
        }),
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert('成功', '密码修改成功');
        setShowChangePassword(false);
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        Alert.alert('错误', data.message || '密码修改失败');
      }
    } catch (error) {
      Alert.alert('错误', '网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePhone = async () => {
    if (!/^\d{11}$/.test(newPhone)) {
      Alert.alert('错误', '请输入正确的手机号');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/change-phone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`,
        },
        body: JSON.stringify({
          phone: newPhone,
        }),
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert('成功', '手机号修改成功');
        updateUserInfo({ phone: newPhone });
        setShowChangePhone(false);
        setNewPhone('');
      } else {
        Alert.alert('错误', data.message || '手机号修改失败');
      }
    } catch (error) {
      Alert.alert('错误', '网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title="账号管理">
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
        {/* 账号信息 */}
        <View className="bg-white rounded-2xl mb-4 shadow-sm overflow-hidden">
          <Text className="text-lg font-bold text-gray-900 p-4 pb-2">账号信息</Text>
          
          <TouchableOpacity 
            className="flex-row items-center justify-between p-4 border-b border-gray-100"
            onPress={() => setShowChangePhone(true)}
          >
            <View className="flex-row items-center">
              <Ionicons name="phone-portrait" size={24} color="#6b7280" />
              <Text className="text-gray-700 ml-3">手机号</Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-gray-500 mr-2">{user?.phone || '未绑定'}</Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            className="flex-row items-center justify-between p-4"
            onPress={() => setShowChangePassword(true)}
          >
            <View className="flex-row items-center">
              <Ionicons name="lock-closed" size={24} color="#6b7280" />
              <Text className="text-gray-700 ml-3">修改密码</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* 账号安全 */}
        <View className="bg-white rounded-2xl mb-4 shadow-sm overflow-hidden">
          <Text className="text-lg font-bold text-gray-900 p-4 pb-2">账号安全</Text>
          
          <View className="flex-row items-center justify-between p-4 border-b border-gray-100">
            <View className="flex-row items-center">
              <Ionicons name="shield-checkmark" size={24} color="#10b981" />
              <Text className="text-gray-700 ml-3">账号状态</Text>
            </View>
            <Text className="text-green-600 font-medium">安全</Text>
          </View>

          <View className="flex-row items-center justify-between p-4">
            <View className="flex-row items-center">
              <Ionicons name="time" size={24} color="#6b7280" />
              <Text className="text-gray-700 ml-3">注册时间</Text>
            </View>
            <Text className="text-gray-500">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '-'}</Text>
          </View>
        </View>

        {/* 危险操作 */}
        <View className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <Text className="text-lg font-bold text-red-600 p-4 pb-2">危险操作</Text>
          
          <TouchableOpacity 
            className="flex-row items-center justify-between p-4"
            onPress={() => {
              Alert.alert(
                '确认注销',
                '注销账号后，所有数据将被永久删除且无法恢复。确定要注销吗？',
                [
                  { text: '取消', style: 'cancel' },
                  { 
                    text: '确定注销', 
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/delete-account`, {
                          method: 'DELETE',
                          headers: {
                            'Authorization': `Bearer ${user?.token}`,
                          },
                        });
                        const data = await response.json();
                        if (data.success) {
                          router.replace('/login');
                        } else {
                          Alert.alert('错误', data.message || '注销失败');
                        }
                      } catch (error) {
                        Alert.alert('错误', '网络错误，请稍后重试');
                      }
                    }
                  },
                ]
              );
            }}
          >
            <View className="flex-row items-center">
              <Ionicons name="trash" size={24} color="#ef4444" />
              <Text className="text-red-600 ml-3">注销账号</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 修改密码弹窗 */}
      <Modal visible={showChangePassword} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 items-center justify-center p-4">
          <View className="bg-white rounded-2xl w-full max-w-md p-6">
            <Text className="text-xl font-bold text-gray-900 mb-6">修改密码</Text>
            
            <TextInput
              className="bg-gray-100 rounded-xl p-4 mb-3 text-gray-900"
              placeholder="原密码"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              value={oldPassword}
              onChangeText={setOldPassword}
            />
            <TextInput
              className="bg-gray-100 rounded-xl p-4 mb-3 text-gray-900"
              placeholder="新密码（至少 6 位）"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <TextInput
              className="bg-gray-100 rounded-xl p-4 mb-6 text-gray-900"
              placeholder="确认新密码"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <View className="flex-row gap-3">
              <TouchableOpacity 
                className="flex-1 bg-gray-200 rounded-xl p-4 items-center"
                onPress={() => {
                  setShowChangePassword(false);
                  setOldPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
              >
                <Text className="text-gray-700 font-medium">取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className="flex-1 bg-blue-500 rounded-xl p-4 items-center"
                onPress={handleChangePassword}
                disabled={loading}
              >
                <Text className="text-white font-medium">{loading ? '处理中...' : '确定'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 修改手机号弹窗 */}
      <Modal visible={showChangePhone} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 items-center justify-center p-4">
          <View className="bg-white rounded-2xl w-full max-w-md p-6">
            <Text className="text-xl font-bold text-gray-900 mb-6">修改手机号</Text>
            
            <TextInput
              className="bg-gray-100 rounded-xl p-4 mb-6 text-gray-900"
              placeholder="新手机号"
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
              value={newPhone}
              onChangeText={setNewPhone}
              maxLength={11}
            />

            <View className="flex-row gap-3">
              <TouchableOpacity 
                className="flex-1 bg-gray-200 rounded-xl p-4 items-center"
                onPress={() => {
                  setShowChangePhone(false);
                  setNewPhone('');
                }}
              >
                <Text className="text-gray-700 font-medium">取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className="flex-1 bg-blue-500 rounded-xl p-4 items-center"
                onPress={handleChangePhone}
                disabled={loading}
              >
                <Text className="text-white font-medium">{loading ? '处理中...' : '确定'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
