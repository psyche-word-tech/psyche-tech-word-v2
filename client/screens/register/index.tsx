import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image, Alert } from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { API_BASE_URL } from '@/utils/apiConfig';

const logo = require('@/assets/logo.png');

export default function RegisterPage() {
  const router = useSafeRouter();
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState('');

  const handleSendCode = async () => {
    if (!phone || phone.length !== 11) {
      return;
    }
    setLoading(true);
    // 发送验证码 API
    /**
     * 服务端文件：server/src/routes/auth.ts
     * 接口：POST /api/v1/auth/send-code
     * Body 参数：phone: string
     */
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const result = await response.json();
      if (result.success) {
        if (result.code) {
          setDevCode(result.code);
        }
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
      } else {
        Alert.alert('发送失败', result.error || '请稍后重试');
      }
    } catch (error) {
      console.error('发送验证码失败:', error);
      Alert.alert('错误', '网络连接失败，请稍后重试');
    }
    setLoading(false);
  };

  const handleRegister = async () => {
    if (!phone || !password || !code) {
      Alert.alert('提示', '请填写完整信息');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('提示', '两次输入的密码不一致');
      return;
    }
    setLoading(true);
    try {
      /**
       * 服务端文件：server/src/routes/auth.ts
       * 接口：POST /api/v1/auth/register
       * Body 参数：phone: string, password: string, code: string
       */
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password, code }),
      });
      const data = await response.json();

      if (data.success) {
        // 自动登录
        await login({
          id: data.user.id,
          username: data.user.username || phone,
          phone: phone,
          token: '',
        });
        Alert.alert('注册成功', '欢迎加入！');
        router.replace('/study');
      } else {
        Alert.alert('注册失败', data.error || '请稍后重试');
      }
    } catch (error) {
      console.error('注册错误:', error);
      Alert.alert('错误', '网络连接失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        {/* Top Header Bar */}
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← 返回</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>注册</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Register Form */}
        <View style={styles.formContainer}>
          <Image 
            source={logo} 
            style={styles.logoImage}
            resizeMode="contain"
          />
          
          {/* Phone Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>手机号</Text>
            <View style={styles.phoneRow}>
              <TextInput
                style={styles.phoneInput}
                placeholder="请输入手机号"
                placeholderTextColor="#999999"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={11}
              />
              <TouchableOpacity 
                style={[styles.codeButton, (!phone || phone.length !== 11) && styles.codeButtonDisabled]}
                onPress={handleSendCode}
                disabled={!phone || phone.length !== 11 || countdown > 0}
              >
                <Text style={[styles.codeText, countdown > 0 && styles.codeTextDisabled]}>
                  {countdown > 0 ? `${countdown}s` : '获取验证码'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Verification Code */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>验证码</Text>
            <TextInput
              style={styles.input}
              placeholder="请输入验证码"
              placeholderTextColor="#999999"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>

          {/* Password */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>设置密码</Text>
            <TextInput
              style={styles.input}
              placeholder="请设置密码"
              placeholderTextColor="#999999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {/* Confirm Password */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>确认密码</Text>
            <TextInput
              style={styles.input}
              placeholder="请再次输入密码"
              placeholderTextColor="#999999"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View>
          
          {/* Register Button */}
          <TouchableOpacity 
            style={styles.registerButton}
            onPress={handleRegister}
          >
            <Text style={styles.registerText}>注册</Text>
          </TouchableOpacity>

          {/* Login Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>已有账号？</Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.linkText}>登录</Text>
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
    backgroundColor: '#FFFFFF',
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F5F5F5',
  },
  backText: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'serif',
  },
  headerTitle: {
    fontSize: 16,
    color: '#333333',
    fontFamily: 'serif',
    fontWeight: '600',
  },
  headerRight: {
    width: 50,
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 20,
  },
  logoImage: {
    width: 60,
    height: 60,
    alignSelf: 'center',
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: '#666666',
    fontFamily: 'serif',
    marginBottom: 8,
  },
  input: {
    padding: 14,
    fontSize: 14,
    fontFamily: 'serif',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneInput: {
    flex: 1,
    padding: 14,
    fontSize: 14,
    fontFamily: 'serif',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginRight: 10,
  },
  codeButton: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#333333',
    borderRadius: 8,
  },
  codeButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  codeText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontFamily: 'serif',
  },
  codeTextDisabled: {
    color: '#FFFFFF',
  },
  registerButton: {
    padding: 16,
    backgroundColor: '#333333',
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  registerText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontFamily: 'serif',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 13,
    color: '#999999',
    fontFamily: 'serif',
  },
  linkText: {
    fontSize: 13,
    color: '#333333',
    fontFamily: 'serif',
    fontWeight: '600',
    marginLeft: 4,
  },
});
