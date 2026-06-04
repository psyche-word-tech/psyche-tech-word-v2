# 重新 prebuild 更新 Android 资源

## 问题原因
`android/` 目录是之前 `npx expo prebuild` 生成的，里面的 `strings.xml`、图标、启动页配置都是基于旧的 `app.config.ts`（"单词记"）。修改 `app.config.ts` 后必须重新 prebuild 才能更新这些原生资源。

## 操作步骤

```cmd
cd C:\p\client

:: 1. 备份 build.gradle 中的 packagingOptions 修改
type "android\app\build.gradle" | findstr "libworklets"
:: 确认输出了 pickFirst '**/libworklets.so'，记住位置

:: 2. 删除旧的 android 目录（保留备份）
move android android-backup

:: 3. 重新 prebuild
npx expo prebuild --platform android

:: 4. 恢复 packagingOptions 修改
:: 打开 android/app/build.gradle，在 android { ... } 块内添加：
::     packagingOptions {
::         pickFirst '**/libworklets.so'
::     }

:: 5. 重新构建 APK
cd android
.\gradlew assembleDebug --no-daemon
```

## 更轻量的替代方案（不改 android 目录）

如果你不想重新 prebuild，可以手动改这几个文件：

### 1. 应用名
打开 `android/app/src/main/res/values/strings.xml`，改为：
```xml
<resources>
  <string name="app_name">Psyche Tech</string>
</resources>
```

### 2. 图标
`adaptive-icon.png` 的修改需要重新生成 Android 图标资源。手动替换比较麻烦，建议重新 prebuild。

### 3. 启动页动画
确保 `app/_layout.tsx` 和 `components/AnimatedSplash.tsx` 中的 SplashScreen 代码已拉取（git pull 后检查）。

## 推荐
直接重新 prebuild（步骤 1-5），最干净。
