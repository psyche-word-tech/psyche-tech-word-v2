# Word Voyage 鸿蒙 NEXT 版

鸿蒙 HarmonyOS NEXT 套壳应用，使用 WebView 加载前端页面。

## 前置要求

1. 前端必须部署到一个可访问的 HTTPS URL（如 Vercel、GitHub Pages）
2. 安装 DevEco Studio 5.0+
3. 注册华为开发者账号并完成实名认证

## 配置步骤

### 1. 部署前端页面

#### 方案 A：Vercel 部署（推荐）

1. 访问 [vercel.com](https://vercel.com)，用 GitHub 登录
2. 点击 "Add New Project"，导入 `psyche-word-tech/psyche-tech-word-v2` 仓库
3. 配置：
   - **Framework Preset**: Other
   - **Build Command**: `cd client && npx expo export --platform web`
   - **Output Directory**: `client/dist`
4. 点击 Deploy
5. 部署完成后，复制域名（如 `https://xxx.vercel.app`）

#### 方案 B：GitHub Pages 部署

1. 在仓库 Settings > Pages 中启用 GitHub Pages
2. Source 选择 GitHub Actions
3. 系统会自动使用仓库中的 `.github/workflows/deploy.yml` 工作流
4. 部署完成后，复制域名（如 `https://psyche-word-tech.github.io/psyche-tech-word-v2`）

### 2. 修改鸿蒙项目中的前端地址

打开 `entry/src/main/ets/pages/Index.ets`，修改 `FRONTEND_URL`：

```typescript
const FRONTEND_URL = 'https://你的部署地址/';
```

### 3. 在 DevEco Studio 中打开项目

1. 打开 DevEco Studio
2. File > Open，选择 `harmony-app` 文件夹
3. 等待 Gradle 同步完成

### 4. 配置签名

1. Build > Generate Key and CSR
2. 或者使用自动签名：File > Project Structure > Signing Configs > 勾选 Support HarmonyOS > 勾选 Automatically generate signing

### 5. 构建 HAP

1. Build > Build HAP(s)/APP(s) > Build HAP(s)
2. 生成的 `.hap` 文件在 `entry/build/outputs/default/` 目录

### 6. 安装到鸿蒙设备

#### 方式一：USB 连接真机

1. 手机开启开发者模式（设置 > 关于手机 > 版本号连点 7 次）
2. 开启 USB 调试（设置 > 系统 > 开发者选项 > USB 调试）
3. 用 USB 连接电脑
4. 在 DevEco Studio 中点击运行按钮（▶️）

#### 方式二：通过华为应用市场发布

1. 注册华为开发者账号
2. 在 [AppGallery Connect](https://developer.huawei.com/consumer/cn/service/josp/agc/index.html) 创建应用
3. 上传 HAP 文件进行审核

## 项目结构

```
harmony-app/
├── AppScope/               # 应用级配置
│   ├── app.json5          # 应用配置
│   └── resources/         # 应用级资源
├── entry/                  # 入口模块
│   ├── src/main/ets/      # ArkTS 源码
│   │   ├── entryability/  # Ability 入口
│   │   └── pages/         # 页面
│   │       └── Index.ets  # 主页面（WebView）
│   └── src/main/resources/# 模块资源
└── build-profile.json5    # 构建配置
```

## 注意事项

1. **网络权限**：`module.json5` 中已声明 `ohos.permission.INTERNET`
2. **混合内容**：如果前端是 HTTP 而非 HTTPS，需要配置 `mixedMode(MixedMode.All)`
3. **本地存储**：WebView 已开启 `domStorageAccess` 和 `databaseAccess`，支持 localStorage
4. **状态栏**：页面顶部预留了状态栏高度，避免内容被刘海屏遮挡

## 常见问题

### Q: 页面显示空白
检查 `FRONTEND_URL` 是否正确，确保末尾有斜杠 `/`。

### Q: 跨域问题
确保后端 API（Railway）已配置 CORS，允许前端域名访问。

### Q: 路由刷新 404
确保前端部署服务已配置 SPA 路由回退（Vercel 默认支持，GitHub Pages 需要额外配置）。
