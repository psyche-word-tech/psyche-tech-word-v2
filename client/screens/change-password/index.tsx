import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import { getApiBaseUrl } from '@/utils/apiConfig';
import { useState, useEffect } from 'react';

export default function ChangePasswordScreen() {
  const router = useSafeRouter();
  const { user } = useAuth();
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/v1/user/password-status`, {
          headers: { Authorization: `Bearer ${user?.token}` },
        });
        const data = await res.json();
        setHasPassword(!!data.hasPassword);
      } catch (e) {
        setHasPassword(false);
      }
    })();
  }, [user?.token]);

  const handleChangePassword = async () => {
    if (hasPassword !== false) {
      if (!oldPassword) {
        Alert.alert('提示', '请输入当前密码');
        return;
      }
    }
    if (!newPassword || !confirmPassword) {
      Alert.alert('提示', '请填写所有字段');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('提示', '两次输入的新密码不一致');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('提示', '新密码长度不能少于 6 位');
      return;
    }

    setErrMsg('');
    setLoading(true);
    try {
      const body: any = {
        userId: user?.id,
        oldPassword: hasPassword === false ? '' : oldPassword,
        newPassword,
      };
      const response = await fetch(`${getApiBaseUrl()}/api/v1/user/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.success) {
        router.back();
      } else {
        setErrMsg(data.error || '密码修改失败');
      }
    } catch (error) {
      setErrMsg('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Header title={hasPassword === false ? '设置密码' : '修改密码'} />
      <View style={{ flex: 1, backgroundColor: '#f5f5f5', padding: 16 }}>
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          {hasPassword === false ? (
            <Text style={{ fontSize: 13, color: '#999', marginBottom: 12 }}>
              你尚未设置密码，请设置一个新密码来保护账号安全。
            </Text>
          ) : (
            <>
              <Text style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>当前密码</Text>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: '#e0e0e0',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16,
                  marginBottom: 16,
                }}
                placeholder="请输入当前密码"
                secureTextEntry
                value={oldPassword}
                onChangeText={setOldPassword}
              />
            </>
          )}

          <Text style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>新密码</Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: '#e0e0e0',
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              marginBottom: 16,
            }}
            placeholder="请输入新密码（至少 6 位）"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />

          <Text style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>确认新密码</Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: '#e0e0e0',
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
            }}
            placeholder="请再次输入新密码"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        </View>

        {errMsg ? (
          <Text style={{ fontSize: 13, color: '#e53935', marginBottom: 12 }}>{errMsg}</Text>
        ) : null}

        <TouchableOpacity
          style={{
            backgroundColor: '#1890ff',
            borderRadius: 8,
            padding: 14,
            alignItems: 'center',
            opacity: loading ? 0.6 : 1,
          }}
          onPress={handleChangePassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
              {hasPassword === false ? '确认设置' : '确认修改'}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={{ fontSize: 12, color: '#999', textAlign: 'center', marginTop: 16 }}>
          {hasPassword === false
            ? '设置密码后，可通过密码方式登录账号'
            : '修改密码后，其他设备需要重新登录'}
        </Text>
      </View>
    </Screen>
  );
}
