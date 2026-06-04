import { ExpoConfig, ConfigContext } from 'expo/config';

// 从环境变量或 .env 文件获取后端地址
const backendBaseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || '';

const appName = 'Psyche Tech';
const projectId = process.env.COZE_PROJECT_ID || process.env.EXPO_PUBLIC_COZE_PROJECT_ID;
const slugAppName = 'psyche-tech';

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...config,
    "name": appName,
    "slug": slugAppName,
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "myapp",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash-logo.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.psychetech.wordbook"
    },
    "web": {
      "bundler": "metro",
      "output": "single",
      "favicon": "./assets/images/favicon.png"
    },
    // 关键：将后端地址注入到 extra 中，供运行时使用
    "extra": {
      ...config.extra,
      "eas": {
        "projectId": "fe451a1b-dbcb-4d2b-b929-f2404fbd892c"
      },
      "backendBaseUrl": backendBaseUrl || 'http://localhost:9091'
    },
    "plugins": [
      'expo-router',
      [
        "expo-image-picker",
        {
          "photosPermission": `允许单词记App访问您的相册，以便您上传或保存图片。`,
          "cameraPermission": `允许单词记App使用您的相机，以便您直接拍摄照片上传。`,
          "microphonePermission": `允许单词记App访问您的麦克风，以便您拍摄带有声音的视频。`
        }
      ],
      [
        "expo-location",
        {
          "locationWhenInUsePermission": `单词记App需要访问您的位置以提供周边服务及导航功能。`
        }
      ],
      [
        "expo-camera",
        {
          "cameraPermission": `单词记App需要相机以拍摄照片和视频。`,
          "microphonePermission": `单词记App需要麦克风以录制视频声音。`,
          "recordAudioAndroid": true
        }
      ],
      [
        "expo-font",
        {
          "fonts": ["./assets/fonts/TimesNewRoman.ttf"]
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
