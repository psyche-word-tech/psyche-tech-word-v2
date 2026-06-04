# 背单词 App 部署指南

## 架构说明

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│   Android   │────▶│   Railway API   │────▶│   Supabase   │
│     App     │     │   (Backend)     │     │  (Database)  │
└─────────────┘     └─────────────────┘     └──────────────┘
```

## 部署步骤

### 第一步：获取 Coze 平台的 Supabase 配置

1. 登录 Coze 平台
2. 进入项目设置 → 集成 → Supabase
3. 复制以下配置信息：
   - URL
   - Anon Key
   - Service Role Key

### 第二步：在 GitHub 创建仓库

1. 登录 GitHub：https://github.com
2. 点击右上角「+」→ 「New repository」
3. 填写仓库名称：`vocab-app`
4. 选择「Private」（私有）或「Public」（公开）
5. 点击「Create repository」

### 第三步：推送代码到 GitHub

在终端执行以下命令（将 `YOUR_USERNAME` 替换为你的 GitHub 用户名）：

```bash
cd /workspace/projects
git remote add origin https://github.com/YOUR_USERNAME/vocab-app.git
git branch -M main
git push -u origin main
```

### 第四步：部署后端到 Railway

1. 访问 https://railway.app
2. 点击「Login」→ 使用 GitHub 账号登录
3. 点击「New Project」→「Deploy from GitHub repo」
4. 选择 `vocab-app` 仓库
5. 在「Variables」中添加以下环境变量（从 Coze 平台获取）：

   | 变量名 | 值 |
   |--------|-----|
   | `COZE_SUPABASE_URL` | 你的 Supabase URL |
   | `COZE_SUPABASE_ANON_KEY` | 你的 Anon Key |
   | `COZE_SUPABASE_SERVICE_ROLE_KEY` | 你的 Service Role Key |
   | `PORT` | `9091` |
   | `NODE_ENV` | `production` |

6. 点击「Deploy」等待部署完成
7. 部署成功后，Railway 会显示你的后端地址，如：
   `https://vocab-app.up.railway.app`

### 第五步：更新客户端配置

1. 编辑 `/client/.env.production` 文件：
   ```bash
   EXPO_PUBLIC_BACKEND_BASE_URL=https://vocab-app.up.railway.app
   ```

2. 编辑 `/client/app.config.ts` 文件，将默认地址改为你的 Railway 地址：
   ```typescript
   const backendBaseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
   ```

### 第六步：重新打包 APK

```bash
cd client

# 重新生成 Android 原生项目
npx expo prebuild --platform android --clean

# 打包 release 版本
cd android
./gradlew assembleRelease
```

APK 文件位置：`android/app/build/outputs/apk/release/app-release.apk`

---

## 验证部署

### 测试后端 API

```bash
curl https://vocab-app.up.railway.app/api/v1/health
```

预期响应：`{"success":true,"message":"服务正常"}`

### 测试词汇书接口

```bash
curl https://vocab-app.up.railway.app/api/v1/wordbooks
```

---

## 常见问题

### Q: Railway 部署失败？
A: 检查环境变量是否正确填写，特别是 Supabase 的三个密钥。

### Q: App 无法连接后端？
A: 确认 `.env.production` 中的 `EXPO_PUBLIC_BACKEND_BASE_URL` 与 Railway 提供的地址一致。

### Q: 如何更新代码？
A: 推送新代码到 GitHub 后，Railway 会自动重新部署。

---

## Railway 免费额度

| 项目 | 额度 |
|------|------|
| 月使用时间 | 500 小时 |
| 内存 | 1 GB |
| 并发项目 | 3 个 |
| 带宽 | 100 GB/月 |

超出免费额度后按量付费，个人使用通常不会超限。
