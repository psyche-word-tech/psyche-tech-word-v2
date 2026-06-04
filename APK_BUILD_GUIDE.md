# 本地 APK 构建步骤

## 1. 拉取最新代码

```cmd
cd C:\p\client
git pull origin main
```

## 2. 确保 node_modules 完整

```cmd
cd C:\p\client
rd /s /q node_modules
npm install --legacy-peer-deps
```

确认原生模块的 android 目录存在：
```cmd
dir "node_modules\react-native-svg\android\build.gradle"
dir "node_modules\react-native-reanimated\android\build.gradle"
dir "node_modules\react-native-worklets\android\build.gradle"
```

## 3. 修改 android/app/build.gradle（如尚未修改）

在 `android { ... }` 块内添加（和 `buildTypes` 同级）：

```gradle
    packagingOptions {
        pickFirst '**/libworklets.so'
    }
```

**完整参考位置**：
```gradle
android {
    ndkVersion rootProject.ext.ndkVersion
    buildToolsVersion rootProject.ext.buildToolsVersion
    compileSdk rootProject.ext.compileSdkVersion

    namespace 'com.psychetech.wordbook'
    defaultConfig { ... }

    packagingOptions {
        pickFirst '**/libworklets.so'
    }

    signingConfigs { ... }
    buildTypes { ... }
}
```

## 4. 确保其他修改已应用

| 文件 | 修改内容 |
|---|---|
| `app.config.ts` | `name: 'Psyche Tech'` |
| `app/_layout.tsx` | 顶部添加 `SplashScreen.preventAutoHideAsync()` |
| `components/AnimatedSplash.tsx` | `useEffect` 开头添加 `SplashScreen.hideAsync()` |
| `assets/images/adaptive-icon.png` | 内容缩小到 66% 安全圆形区域内 |

## 5. 构建 APK

```cmd
cd C:\p\client\android
.\gradlew assembleDebug --no-daemon
```

首次构建约 15-20 分钟，后续增量构建约 1-2 分钟。

APK 输出路径：
```
C:\p\client\android\app\build\outputs\apk\debug\app-debug.apk
```

## 6. 安装到手机

```cmd
adb install -r C:\p\client\android\app\build\outputs\apk\debug\app-debug.apk
```

或手动复制到手机安装。
