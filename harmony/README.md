# 单词之旅 - 鸿蒙 NEXT 版

鸿蒙 NEXT（HarmonyOS NEXT）WebView 套壳项目，将现有的 Web 版单词之旅打包为原生鸿蒙 App。

## 项目结构

```
harmony/
├── AppScope/                  # 应用级配置
│   ├── app.json5             # 应用信息（包名、版本等）
│   └── resources/            # 应用级资源
├── entry/                     # 入口模块
│   ├── src/main/
│   │   ├── ets/
│   │   │   ├── entryability/ # Ability（生命周期管理）
│   │   │   └── pages/        # 页面
│   │   │       └── Index.ets # WebView 主页面
│   │   ├── module.json5      # 模块配置
│   │   └── resources/        # 模块资源
│   └── build-profile.json5   # 模块构建设置
├── build-profile.json5        # 工程构建配置
└── hvigorfile.ts             # 构建脚本
```

## 环境要求

- **DevEco Studio** 5.0.0 Release 或更高版本
- **HarmonyOS SDK** API 12 或更高版本
- **Node.js** 18.x 或更高版本

## 快速开始

### 1. 安装 DevEco Studio

下载并安装 [DevEco Studio](https://developer.harmonyos.com/cn/develop/deveco-studio)。

### 2. 打开项目

1. 启动 DevEco Studio
2. 选择 **Open** → 选择 `harmony` 文件夹
3. 等待 Gradle/Hvigor 同步完成

### 3. 修改加载地址（可选）

默认加载线上地址 `http://82.157.60.179:5000`。

如需修改，编辑 `entry/src/main/ets/pages/Index.ets`：

```typescript
@State webUrl: string = 'http://你的地址';
```

### 4. 真机运行（详细步骤）

#### 4.1 注册华为开发者账号

1. 访问 [华为开发者联盟](https://developer.huawei.com/consumer/cn/)
2. 注册/登录账号（可用手机号）
3. 完成实名认证（个人开发者即可）

#### 4.2 在 DevEco Studio 登录

1. 打开 DevEco Studio
2. 点击右上角 **登录图标**（或 File → Settings → Appearance & Behavior → System Settings → HarmonyOS SDK → 登录华为账号）
3. 用华为开发者账号登录

#### 4.3 配置自动签名

1. 点击菜单 **File → Project Structure → Project → Signing Configs**
2. 勾选 **Support HarmonyOS** 和 **Automatically generate signing**
3. 点击 **OK**
4. DevEco Studio 会自动从华为服务器申请调试证书

> 如果自动签名失败，去 [AppGallery Connect](https://developer.huawei.com/consumer/cn/service/josp/agc/index.html) → 用户与访问 → 证书管理，手动创建调试证书。

#### 4.4 开启手机开发者模式

1. 手机「设置 → 关于手机」
2. 连续点击 **版本号** 7 次，开启开发者模式
3. 返回「设置 → 系统和更新 → 开发者选项」
4. 打开：
   - **USB 调试**
   - **仅充电模式下允许 ADB 调试**（如有）

#### 4.5 连接手机并运行

1. 用 USB 数据线连接手机和电脑
2. 手机上弹出的 USB 连接方式选择 **传输文件** 或 **仅充电**
3. 在 DevEco Studio 顶部工具栏，点击设备选择框，选择你的手机
4. 点击 **运行按钮**（绿色三角形）或按 `Shift+F10`
5. 等待编译、签名、安装完成

> 首次安装需要在手机上点击「允许」调试权限。

### 5. 构建 Release 包

Build → Build Hap(s)/App(s) → Build App

构建完成后在 `entry/build/outputs/default` 目录下获取 `.app` 文件。

## 注意事项

1. **HTTP 明文传输**：当前使用 HTTP 地址，鸿蒙 NEXT 默认只允许 HTTPS。代码中已设置 `mixedMode(MixedMode.All)` 允许明文传输，正式发布建议配置 HTTPS。

2. **返回键处理**：当前版本未处理系统返回键，如需支持页面内返回，可在 EntryAbility 中监听返回事件并调用 `webviewController.accessBackward()`。

3. **性能优化**：WebView 加载的是 Web 应用，首次加载需要下载 JS/CSS 资源，建议开启服务端 Gzip 压缩和 CDN 加速。

4. **本地调试**：可将 `webUrl` 改为 `http://localhost:5000`（需确保模拟器/真机能访问开发机网络）。

## 常见问题

### WebView 白屏

- 检查 `webUrl` 是否可访问
- 检查网络权限是否声明（`ohos.permission.INTERNET`）
- 检查是否允许明文 HTTP（`mixedMode`）

### 构建失败

- 确保 DevEco Studio 版本 ≥ 5.0.0
- 确保 SDK 已安装 API 12
- 尝试 File → Invalidate Caches → Restart

## 技术栈

- **框架**：鸿蒙 ArkTS + ArkUI
- **组件**：WebView (`@kit.ArkWeb`)
- **构建工具**：Hvigor
