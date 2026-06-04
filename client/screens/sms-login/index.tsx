import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image, Alert } from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE_URL } from '@/utils/apiConfig';

const logo = require('@/assets/logo.png');

export default function SmsLoginPage() {
  const router = useSafeRouter();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleSendCode = async () => {
    if (!phone || phone.length !== 11) {
      Alert.alert('提示', '请输入正确的11位手机号');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const result = await response.json();
      if (result.success) {
        // 开发环境下显示返回的验证码
        if (result.code) {
          Alert.alert('开发模式', `验证码: ${result.code}`);
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

  const { login } = useAuth();
  const [loginLoading, setLoginLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone || !code) {
      Alert.alert('提示', '请输入手机号和验证码');
      return;
    }
    setLoginLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/sms-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const data = await response.json();

      if (data.success) {
        await login({
          id: data.user.id,
          username: data.user.username || phone,
          phone: phone,
          token: data.token,
        });
        router.replace('/profile');
      } else {
        Alert.alert('登录失败', data.error || '验证码错误');
      }
    } catch (error) {
      console.error('登录错误:', error);
      Alert.alert('错误', '网络连接失败，请稍后重试');
    } finally {
      setLoginLoading(false);
    }
  };

  const handlePasswordLogin = () => {
    router.replace('/login');
  };

  return (
    <Screen>
      <View style={styles.container}>
        {/* Top Header Bar */}
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← 返回</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>验证码登录</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Login Form */}
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
          
          {/* Login Button */}
          <TouchableOpacity 
            style={[styles.loginButton, loginLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loginLoading}
          >
            <Text style={styles.loginText}>{loginLoading ? '登录中...' : '登录'}</Text>
          </TouchableOpacity>

          {/* Password Login Link */}
          <TouchableOpacity 
            style={styles.switchButton}
            onPress={handlePasswordLogin}
          >
            <Text style={styles.switchText}>密码登录</Text>
          </TouchableOpacity>

          {/* Register Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>还没有账号？</Text>
            <TouchableOpacity onPress={() => router.push('/register')}>
              <Text style={styles.linkText}>立即注册</Text>
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
    marginBottom: 30,
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
  loginButton: {
    padding: 16,
    backgroundColor: '#333333',
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  loginButtonDisabled: {
    backgroundColor: '#999999',
  },
  loginText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontFamily: 'serif',
    fontWeight: '600',
  },
  switchButton: {
    alignSelf: 'center',
    marginTop: 20,
    padding: 8,
  },
  switchText: {
    fontSize: 13,
    color: '#666666',
    fontFamily: 'serif',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
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
