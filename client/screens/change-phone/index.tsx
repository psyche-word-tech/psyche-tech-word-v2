import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import { getApiBaseUrl } from '@/utils/apiConfig';
import { useState } from 'react';

export default function ChangePhoneScreen() {
  const router = useSafeRouter();
  const { user } = useAuth();
  const [newPhone, setNewPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const handleSendCode = async () => {
    if (!newPhone || newPhone.length !== 11) {
      Alert.alert('提示', '请输入正确的手机号');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/send-verification-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`,
        },
        body: JSON.stringify({
          phone: newPhone,
          type: 'change_phone',
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCodeSent(true);
        setCountdown(60);
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        Alert.alert('成功', '验证码已发送');
      } else {
        Alert.alert('错误', data.error || '发送失败');
      }
    } catch (error) {
      Alert.alert('错误', '网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePhone = async () => {
    if (!newPhone || !code) {
      Alert.alert('提示', '请填写所有字段');
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
          userId: user?.id,
          newPhone,
          code,
        }),
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert('成功', '手机号修改成功', [
          { text: '确定', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('错误', data.error || '修改失败');
      }
    } catch (error) {
      Alert.alert('错误', '网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Header title="修改手机号" />
      <View style={{ flex: 1, backgroundColor: '#f5f5f5', padding: 16 }}>
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>当前手机号</Text>
          <Text style={{ fontSize: 16, color: '#333', marginBottom: 16 }}>{user?.phone || '未绑定'}</Text>

          <Text style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>新手机号</Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: '#e0e0e0',
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              marginBottom: 16,
            }}
            placeholder="请输入新手机号"
            keyboardType="phone-pad"
            value={newPhone}
            onChangeText={setNewPhone}
          />

          {!codeSent ? (
            <TouchableOpacity
              style={{
                backgroundColor: '#1890ff',
                borderRadius: 8,
                padding: 12,
                alignItems: 'center',
                marginBottom: 16,
              }}
              onPress={handleSendCode}
              disabled={loading}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                {loading ? '发送中...' : '发送验证码'}
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              <Text style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>验证码</Text>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: '#e0e0e0',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16,
                  marginBottom: 16,
                }}
                placeholder="请输入验证码"
                value={code}
                onChangeText={setCode}
              />
              <Text style={{ fontSize: 12, color: '#999', marginBottom: 16 }}>
                {countdown > 0 ? `${countdown}秒后可重新发送` : '验证码已过期，请重新发送'}
              </Text>
            </>
          )}
        </View>

        {codeSent && (
          <TouchableOpacity
            style={{
              backgroundColor: '#1890ff',
              borderRadius: 8,
              padding: 14,
              alignItems: 'center',
              opacity: loading ? 0.6 : 1,
            }}
            onPress={handleChangePhone}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>确认修改</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </Screen>
  );
}
