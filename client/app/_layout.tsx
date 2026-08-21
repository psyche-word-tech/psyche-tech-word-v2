import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { Provider } from '@/components/Provider';
import { ApiConfigProvider } from '@/contexts/ApiConfigContext';
import { AuthProvider } from '@/contexts/AuthContext';
import AnimatedSplash from '@/components/AnimatedSplash';
import 'katex/dist/katex.min.css';

LogBox.ignoreLogs([
  "TurboModuleRegistry.getEnforcing(...): 'RNMapsAirModule' could not be found",
]);

// 阻止系统原生启动页自动隐藏，由 AnimatedSplash 接管控制
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  return (
    <ApiConfigProvider>
      <AuthProvider>
        <Provider>
          <AnimatedSplash />
          <StatusBar style="dark" />
          <Stack
          screenOptions={{
            animation: 'slide_from_right',
            gestureEnabled: true,
            gestureDirection: 'horizontal',
            headerShown: false
          }}
        >
          <Stack.Screen name="index" options={{ title: "" }} />
          <Stack.Screen name="study" options={{ title: "" }} />
          <Stack.Screen name="learn" options={{ title: "" }} />
          <Stack.Screen name="notebook" options={{ title: "" }} />
          <Stack.Screen name="engrave" options={{ title: "" }} />
          <Stack.Screen name="vocabulary" options={{ title: "" }} />
          <Stack.Screen name="purchase" options={{ title: "" }} />
          <Stack.Screen name="my-vocabulary" options={{ title: "" }} />
          <Stack.Screen name="word-list" options={{ title: "" }} />
          <Stack.Screen name="word-detail" options={{ title: "" }} />
			  <Stack.Screen name="word-preview" options={{ title: "" }} />
			  <Stack.Screen name="word-category" options={{ title: "" }} />
          <Stack.Screen name="known-words" options={{ title: "" }} />
          <Stack.Screen name="vague-words" options={{ title: "" }} />
          <Stack.Screen name="unknown-words" options={{ title: "" }} />
          <Stack.Screen name="profile" options={{ title: "" }} />
          <Stack.Screen name="settings" options={{ title: "" }} />
          <Stack.Screen name="login" options={{ title: "" }} />
          <Stack.Screen name="register" options={{ title: "" }} />
          <Stack.Screen name="sms-login" options={{ title: "" }} />
          <Stack.Screen name="calendar" options={{ title: "" }} />
          <Stack.Screen name="tree-diagram" options={{ title: "" }} />
          <Stack.Screen name="subcategory-words" options={{ title: "" }} />
          <Stack.Screen name="competency-map" options={{ title: "" }} />
          <Stack.Screen name="submit-homework" options={{ title: "" }} />
          <Stack.Screen name="teacher-review" options={{ title: "" }} />
          <Stack.Screen name="review-detail" options={{ title: "" }} />
          <Stack.Screen name="vocabulary-books" options={{ title: "" }} />
          <Stack.Screen name="word-book" options={{ title: "" }} />
          <Stack.Screen name="progress" options={{ title: "" }} />
          <Stack.Screen name="achievements" options={{ title: "" }} />
          <Stack.Screen name="account-settings" options={{ title: "" }} />
          <Stack.Screen name="reminder" options={{ title: "" }} />
          <Stack.Screen name="display-settings" options={{ title: "" }} />
          <Stack.Screen name="privacy-settings" options={{ title: "" }} />
          <Stack.Screen name="about" options={{ title: "" }} />
          <Stack.Screen name="change-password" options={{ title: "" }} />
          <Stack.Screen name="change-phone" options={{ title: "" }} />
          <Stack.Screen name="notification-settings" options={{ title: "" }} />
          <Stack.Screen name="data-backup" options={{ title: "" }} />
          <Stack.Screen name="delete-account" options={{ title: "" }} />
          <Stack.Screen name="splash-preview" options={{ title: "" }} />
        </Stack>
      </Provider>
      </AuthProvider>
    </ApiConfigProvider>
  );
}
