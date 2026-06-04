# 本地构建修改清单

以下是你本地 `C:\p\client` 需要修改的文件。建议逐一手动替换。

---

## 1. app.config.ts（修改应用名）

将 `name` 改为 `"Psyche Tech"`：

```ts
export default {
  expo: {
    name: 'Psyche Tech',   // 原来是"单词记"
    slug: 'psyche-tech-wordbook',
    // ... 其余不变
  }
};
```

---

## 2. app/_layout.tsx（阻止系统启动页自动隐藏）

在文件顶部添加：

```tsx
import * as SplashScreen from 'expo-splash-screen';

// 阻止系统原生启动页自动隐藏，等待自定义动画开始后再隐藏
SplashScreen.preventAutoHideAsync().catch(() => {});
```

---

## 3. components/AnimatedSplash.tsx（动画开始时隐藏系统启动页）

在 `useEffect` 开始处添加：

```tsx
import * as SplashScreen from 'expo-splash-screen';

// ... existing code ...

useEffect(() => {
  // 隐藏系统原生启动页，露出我们的自定义飞入动画
  SplashScreen.hideAsync().catch(() => {});

  // ... 其余动画逻辑不变 ...
}, []);
```

---

## 4. android/app/build.gradle（解决 reanimated/worklets 库冲突）

在 `android { ... }` 块内添加 `packagingOptions`：

```gradle
android {
    // ... existing config ...

    packagingOptions {
        pickFirst '**/libworklets.so'
    }
}
```

**注意**：不要放在 `signingConfigs` 内部，要和 `buildTypes` 同级。

---

## 5. assets/images/adaptive-icon.png（修复图标裁剪）

这个文件我已经帮你缩小了内容到 66% 安全圆形区域内。你需要从沙箱下载替换，或者：

用任意图片编辑工具，将图标内容缩放到画布中央约 660x660 像素的区域内（四周留出约 180 像素边距），保持整体尺寸 1024x1024 不变。

---

## 6. 重新构建 APK

```cmd
cd C:\p\client\android
.\gradlew assembleDebug --no-daemon
```

APK 输出位置：
```
C:\p\client\android\app\build\outputs\apk\debug\app-debug.apk
```

---

## 关于 Web 端 "我的词汇书"

Web 预览已恢复正常。如果本地没有后端服务，"我的词汇书" 等需要 API 的页面会显示演示数据（四级、六级、考研、雅思）。

如需本地启动后端，最小后端代码见下方。

---

## 附录：最小后端代码（如需本地测试）

在 `C:\p\server` 创建以下文件：

**package.json**：
```json
{
  "name": "psyche-server",
  "version": "1.0.0",
  "scripts": { "dev": "tsx watch src/index.ts", "build": "tsc", "start": "node dist/index.js" },
  "dependencies": { "cors": "^2.8.5", "express": "^4.18.2", "sqlite3": "^5.1.6" },
  "devDependencies": { "@types/cors": "^2.8.15", "@types/express": "^4.17.21", "tsx": "^4.7.0", "typescript": "^5.3.0" }
}
```

**tsconfig.json**：
```json
{ "compilerOptions": { "target": "ES2020", "module": "commonjs", "outDir": "./dist", "rootDir": "./src", "strict": true, "esModuleInterop": true, "skipLibCheck": true, "forceConsistentCasingInFileNames": true, "resolveJsonModule": true }, "include": ["src/**/*"] }
```

**src/index.ts**：见沙箱中 `/workspace/projects/server/src/index.ts` 的完整内容（词汇书 API 后端）。

启动命令：
```cmd
cd C:\p\server
pnpm install
pnpm dev
```
后端运行在 `http://localhost:9091`。
