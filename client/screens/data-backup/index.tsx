import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import { getApiBaseUrl } from '@/utils/apiConfig';
import { useState } from 'react';

export default function DataBackupScreen() {
  const router = useSafeRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  const handleBackup = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/user/backup-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`,
        },
        body: JSON.stringify({ userId: user?.id }),
      });

      const data = await response.json();

      if (data.success) {
        setLastBackup(new Date().toLocaleString('zh-CN'));
        Alert.alert('成功', '数据备份成功');
      } else {
        Alert.alert('错误', data.error || '备份失败');
      }
    } catch (error) {
      Alert.alert('错误', '网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/user/export-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`,
        },
        body: JSON.stringify({ userId: user?.id }),
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert('成功', '数据导出成功，已发送到您的邮箱');
      } else {
        Alert.alert('错误', data.error || '导出失败');
      }
    } catch (error) {
      Alert.alert('错误', '网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Header title="数据备份" />
      <ScrollView style={{ flex: 1, backgroundColor: '#f5f5f5' }} contentContainerStyle={{ padding: 16 }}>
        {/* 备份状态 */}
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 }}>备份状态</Text>
          <Text style={{ fontSize: 14, color: '#666' }}>
            上次备份：{lastBackup || '从未备份'}
          </Text>
        </View>

        {/* 备份选项 */}
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            overflow: 'hidden',
            marginBottom: 16,
          }}
        >
          <TouchableOpacity
            style={{
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: '#f0f0f0',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
            onPress={handleBackup}
            disabled={loading}
          >
            <View>
              <Text style={{ fontSize: 16, color: '#333', marginBottom: 4 }}>立即备份</Text>
              <Text style={{ fontSize: 12, color: '#999' }}>备份学习进度和设置</Text>
            </View>
            {loading ? <ActivityIndicator /> : <Text style={{ fontSize: 16, color: '#ccc' }}>›</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: '#f0f0f0',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
            onPress={handleExport}
            disabled={loading}
          >
            <View>
              <Text style={{ fontSize: 16, color: '#333', marginBottom: 4 }}>导出数据</Text>
              <Text style={{ fontSize: 12, color: '#999' }}>导出所有学习数据到本地</Text>
            </View>
            {loading ? <ActivityIndicator /> : <Text style={{ fontSize: 16, color: '#ccc' }}>›</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
            onPress={() => Alert.alert('提示', '自动备份功能开发中')}
          >
            <View>
              <Text style={{ fontSize: 16, color: '#333', marginBottom: 4 }}>自动备份</Text>
              <Text style={{ fontSize: 12, color: '#999' }}>每日自动备份学习数据</Text>
            </View>
            <Text style={{ fontSize: 16, color: '#ccc' }}>›</Text>
          </TouchableOpacity>
        </View>

        <Text style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>
          备份数据将安全存储在云端，更换设备后可恢复
        </Text>
      </ScrollView>
    </Screen>
  );
}
