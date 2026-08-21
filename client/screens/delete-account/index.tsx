import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import { getApiBaseUrl } from '@/utils/apiConfig';
import { useState } from 'react';

export default function DeleteAccountScreen() {
  const router = useSafeRouter();
  const { user, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDeleteAccount = async () => {
    if (!password) {
      Alert.alert('提示', '请输入密码确认');
      return;
    }

    Alert.alert(
      '确认注销',
      '注销后账号及所有数据将被永久删除且无法恢复，确定要注销吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定注销',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/delete-account`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${user?.token}`,
                },
                body: JSON.stringify({
                  userId: user?.id,
                  password,
                }),
              });

              const data = await response.json();

              if (data.success) {
                await logout();
                Alert.alert('成功', '账号已注销', [
                  { text: '确定', onPress: () => router.replace('/login') },
                ]);
              } else {
                Alert.alert('错误', data.error || '注销失败');
              }
            } catch (error) {
              Alert.alert('错误', '网络错误，请稍后重试');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Screen>
      <Header title="注销账号" />
      <View style={{ flex: 1, backgroundColor: '#f5f5f5', padding: 16 }}>
        {/* 警告信息 */}
        <View
          style={{
            backgroundColor: '#fff2f0',
            borderLeftWidth: 4,
            borderLeftColor: '#ff4d4f',
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#ff4d4f', marginBottom: 8 }}>
            ⚠️ 重要提示
          </Text>
          <Text style={{ fontSize: 14, color: '#666', lineHeight: 22 }}>
            注销账号后，以下数据将被永久删除且无法恢复：
          </Text>
          <Text style={{ fontSize: 14, color: '#666', lineHeight: 22, marginTop: 8 }}>
            • 账号信息和登录凭证{'\n'}
            • 学习进度和记录{'\n'}
            • 词汇书和生词本{'\n'}
            • 成就和统计数据{'\n'}
            • 所有个人设置
          </Text>
        </View>

        {/* 密码确认 */}
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
            请输入密码确认注销
          </Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: '#e0e0e0',
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
            }}
            placeholder="请输入密码"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        {/* 注销按钮 */}
        <TouchableOpacity
          style={{
            backgroundColor: '#ff4d4f',
            borderRadius: 8,
            padding: 14,
            alignItems: 'center',
            opacity: loading ? 0.6 : 1,
          }}
          onPress={handleDeleteAccount}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
              确认注销账号
            </Text>
          )}
        </TouchableOpacity>

        <Text style={{ fontSize: 12, color: '#999', textAlign: 'center', marginTop: 16 }}>
          如有问题，请联系客服：support@example.com
        </Text>
      </View>
    </Screen>
  );
}
