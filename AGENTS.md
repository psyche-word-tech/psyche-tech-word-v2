# Expo App + Express.js

## 目录结构规范（严格遵循）

当前仓库是一个 monorepo（基于 pnpm 的 workspace）

- Expo 代码在 client 目录，Express.js 代码在 server 目录
- 本模板默认无 Tab Bar，可按需改造

├── client/                     # React Native 前端代码
│   ├── app/                    # Expo Router 路由目录（仅路由配置）
│   │   ├── _layout.tsx         # 根布局文件（必需，务必阅读）
│   │   └── index.tsx           # 首页
│   ├── screens/                # 页面实现目录（与 app/ 路由对应）
│   │   └── demo/               # 示例页面
│   │       └── index.tsx
│   ├── components/             # 可复用组件
│   │   └── Screen.tsx          # 页面容器组件（必用）
│   ├── hooks/                  # 自定义 Hooks
│   ├── contexts/               # React Context 代码
│   ├── utils/                  # 工具函数
│   ├── assets/                 # 静态资源
|   └── package.json            # Expo 应用 package.json
├── server/                     # 服务端代码根目录 (Express.js)
|   ├── src/
│   │   └── index.ts            # 服务端入口文件
|   └── package.json            # 服务端 package.json
├── package.json
├── .cozeproj                   # 预置脚手架脚本（禁止修改）
└── .coze                       # 配置文件（禁止修改）

## 样式方案

基于 tailwindcss 进行样式开发（底层基于 Uniwind）

写法示例：

```tsx
<View className="flex-1 bg-white dark:bg-gray-900 p-4"></View>
```

```tsx
<Text
  className="text-lg font-bold text-gray-900 dark:text-white"
  selectionColorClassName="accent-blue-500"
>
  Hello World
</Text>
```

Uniwind 官方文档：https://docs.uniwind.dev/llms.txt

## 如何进行静态校验（TSC + ESLint）

```bash
# 对 client 和 server 目录同时进行校验
pnpm -w lint:all

# 对 client 目录进行校验
pnpm -w lint:client

# 对 server 目录进行校验
pnpm -w lint:server
```

## 如何修改主题模式（跟随系统、固定暗色、固定亮色）

默认为跟随系统，如果用户明确指定为“暗色”或“亮色”，需要修改 `client/components/ColorSchemeUpdater.tsx` 的 `DEFAULT_THEME` 变量为合适的值

## 如何定制主题 design tokens

当前项目的**设计系统**基于 tailwindcss 实现，核心入口文件为 `client/global.css`，如果需要定制主题，应该**阅读并修改 `client/global.css` 文件**

## 路由及 Tab Bar 实现规范

### 方案一：无 Tab Bar（Stack 导航）

适用于线性流程应用，采用简化的目录结构：

```
client/app/
├── _layout.tsx         # 根布局（Stack 导航配置）
├── index.tsx           # 应用入口
├── detail.tsx          # 详情页（通过 params 传递数据）
└── +not-found.tsx      # 404 页面
```

**根布局配置** `client/app/_layout.tsx`：

以下仅为代码片段供写法参考

```tsx
<Stack screenOptions={{ headerShown: false }}>
  <Stack.Screen name="index" />
  <Stack.Screen name="detail" />
</Stack>
```

**应用入口** `client/app/index.tsx`：
```tsx
export { default } from "@/screens/home";
```
> **禁止事项**：无 Tab Bar 场景下，不得创建 `(tabs)` 目录。

### 方案二：有 Tab Bar（Tabs 导航）

采用路由分组实现底部导航栏：
```
client/app/
├── _layout.tsx              # 根布局
├── (tabs)/
│   ├── _layout.tsx          # Tab 导航配置
│   ├── index.tsx            # 默认 Tab（必须存在）
│   ├── discover.tsx         # 发现页
│   └── profile.tsx          # 个人中心
├── detail.tsx               # Tab 外的独立页面（通过 params 传递数据）
└── +not-found.tsx
```
> **⚠️ [CRITICAL]**： `app/index.tsx` 优先级高于 `(tabs)/index.tsx`，会导致首页无 Tab Bar。**当有(tabs)/index.tsx时必须删除 `app/index.tsx`**。

**根布局配置** `client/app/_layout.tsx`：

以下仅为代码片段供写法参考

```tsx
<Stack screenOptions={{ headerShown: false }}>
  <Stack.Screen name="(tabs)" />
  <Stack.Screen name="detail" />
</Stack>
```

**应用入口** `client/app/(tabs)/index.tsx`：
```tsx
export { default } from "@/screens/home";
```

**Tab 布局配置** `client/app/(tabs)/_layout.tsx`：

```tsx
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { useCSSVariable } from 'uniwind';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const [background, muted, accent, border] = useCSSVariable([
    '--color-background',
    '--color-muted',
    '--color-accent',
    '--color-border',
  ]) as string[];

  let tabBarStyle = {
    backgroundColor: background,
    borderTopWidth: 1,
    borderTopColor: border,
  };

  // 用于修复 Web 上高度异常的问题（这个 if 逻辑必须添加）
  if (Platform.OS === 'web') {
    tabBarStyle = {
      ...tabBarStyle,
      height: 'auto',
    }
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: muted,
      }}
    >
      {/* name 必须与文件名完全一致 */}
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="house" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: '发现',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="compass" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="user" size={20} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

**Tab 页面文件** `client/app/(tabs)/index.tsx`：
```tsx
export { default } from "@/screens/home";
```

### 注意事项

在改动 `client/app/_layout.tsx` 前，必须先阅读该文件，再进行修改操作

以下是需要保留的重要逻辑

- 保留 global.css 引入（tailwindcss 生效的关键）
- 保留 Provider 的使用

## 依赖管理与模块导入规范

### 依赖安装
**禁止**使用 `npm` 或 `yarn`，按目录区分安装命令：

| 目录 | 安装命令 | 说明 |
|------|----------|------|
| `client/` | `npx expo install <package>` | Expo 会自动选择与 SDK 兼容的版本 |
| `server/` | `pnpm add <package>` | 使用 pnpm 管理后端依赖 |

```bash
# client 目录（Expo 项目）
cd client && npx expo install expo-camera expo-image-picker

# server 目录（Express 项目）
cd server && pnpm add axios cors
```

**网络问题处理**：`npx expo install` 可能因网络原因失败，失败时重试 2 次，仍失败则改用 `pnpm add` 安装

## Expo 开发规范

### 路径别名

Expo 配置了 `@/` 路径别名指向 `client/` 目录：

```tsx
// 正确
import { Screen } from '@/components/Screen';

// 避免相对路径
import { Screen } from '../../../components/Screen';
```

## 本地开发

`coze dev`：用来首次启动前后端服务，也可以用来重启前后端服务（该命令会先尝试杀掉占用端口的进程，再启动服务）

## 预览链路

### 预览方案
- 项目类型：Web 预览型（React Native / Expo Web）
- 预览方式：静态导出 + Express.js 统一服务
- 技术栈：前端静态文件复制到 `server/public/`，后端同时提供前端页面和 API

### 预览配置
- 工作区根目录：`/workspace/projects`
- 技术项目目录：`/workspace/projects`
- 预览脚本：`scripts/coze-preview-run.sh`
- 预览端口：`5000`（IPv4 全接口 `0.0.0.0:5000`）
- 后端端口：`5000`（与前端同一端口）

### 服务启动命令
**重要**：每次重新打开沙箱/电脑后，需要先启动服务：

```bash
# 一键启动（构建前端 + 复制静态文件 + 启动后端）
bash scripts/coze-preview-run.sh
```

### 预览入口
```bash
# 运行（自动构建并启动）
bash scripts/coze-preview-run.sh
```

### 静态文件更新
当修改前端代码后，需要重新导出并复制：
```bash
cd client && npx expo export --platform web
rm -rf ../server/public && cp -r dist ../server/public
```

### 注意事项
- **自动重启机制**：后端使用 nodemon 监听 `dist` 目录，当 `dist` 目录变化时会自动重启服务
- **修改后端代码后**：运行 `bash scripts/coze-preview-run.sh`，脚本会重新构建前端和后端，nodemon 会自动检测 dist 变化并重启服务
- **沙箱重启后**：运行 `bash scripts/coze-preview-run.sh` 启动服务
- 后端服务运行在 `5000` 端口，同时提供前端页面和 API
- 前端静态文件存放在 `server/public/` 目录
- 扣子 App 扫码预览时，所有请求（页面 + API）都通过 5000 端口处理

## 关键配置备忘（当前稳定版本）

### API URL 配置（client/utils/apiConfig.ts）

**使用相对路径（所有环境统一）：**

```typescript
function getApiBaseUrl() {
  // 所有环境都使用相对路径，由后端统一处理
  // 后端监听 5000 端口，同时提供前端页面和 API
  return '';
}
```

**说明：**
- 后端服务监听 5000 端口，同时提供前端静态文件和 API
- 所有环境（本地、沙箱预览、扣子 App WebView）都使用相对路径
- API 请求（如 `/api/v1/solve-problem`）会自动发送到当前域名的后端

### 服务器根路径（server/src/index.ts）

根路径 `/` 必须优先检查并返回 `public/index.html`：

```typescript
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, '../public/index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.json({ status: 'ok', service: 'word-voyage-api' });
});
```

### 鸿蒙 WebView 配置（Index.ets）

```typescript
// 禁用缓存 + URL 加时间戳，避免加载旧内容
aboutToAppear() {
  webview.WebviewController.setWebDebuggingAccess(true);
  this.webUrl = 'http://82.157.60.179:5000?t=' + Date.now();
}

// Web 组件配置
cacheMode(CacheMode.None)  // 完全禁用缓存
```

### 已修复问题清单

1. **白屏**：WebView `CacheMode.None` + URL 时间戳
2. **API JSON 解析错误**：移除服务器 gzip 压缩（WebView fetch 无法解压）
3. **根路径返回 JSON**：改为优先返回 index.html
4. **沙箱预览失效**：恢复 `apiConfig.ts` 完整环境检测
5. **图片加载慢**：压缩 `rock.jpg` 11MB→48KB，`purchase-books.webp` 968KB→28KB
6. **图片裁剪**：`resizeMode="contain"` 替代 `"cover"`
7. **ESM 非法 require**：`require('fs')` → `fs.existsSync`（已导入）
8. **模型文件丢失（已永久修复）**：Express 直接从 `server/models/` 提供模型文件（`app.use('/models', express.static(...))`），不再依赖 `server/public/models/`。无论 public 目录如何重建，模型文件都不受影响。
9. **模型文件返回 HTML（已修复）**：Express 添加 `/models` 路由早期返回，避免 SPA fallback 拦截

## 新增功能：教师批改系统

### 功能概述
学生上传作业图片，教师在线批改（画圈/划线标注 + 文字评语）。

### 数据库表
- `submissions` - 作业提交表
  - `id` - UUID 主键
  - `student_id` - 学生 ID
  - `teacher_id` - 教师 ID
  - `image_url` - 图片 URL
  - `status` - 状态（pending/graded）
  - `grade` - 分数
  - `feedback` - 评语
  - `annotations` - 标注数据（JSONB）
  - `created_at` / `updated_at` - 时间戳

### Storage Bucket
- `submissions` - 存储学生上传的作业图片（公开访问）

### 前端页面
- `submit-homework.tsx` - 学生提交作业（拍照/相册选择）
- `teacher-review.tsx` - 教师批改列表（待批改/已批改统计）
- `review-detail.tsx` - 教师批改详情（图片标注 + 评分 + 评语）

### 后端 API
- `POST /api/submissions` - 提交作业（base64 图片上传）
- `GET /api/submissions?role=teacher` - 获取提交列表
- `PUT /api/submissions/:id` - 更新批改结果
- `GET /api/submissions/:id` - 获取单个提交详情

### 主页入口
右上角加号图标：
- **学生**：点击弹出菜单 → "提交作业"
- **教师**：直接跳转到批改列表页面

### 用户角色区分
- 注册时选择身份（学生/教师）
- 用户表：`user_profiles`（role 字段：student/teacher）
- 登录后根据角色显示不同功能入口

## 新增功能：英语作文 AI 批改（essay-grading）

### 批改流水线（三层协作）
1. **千问 VL（qwen 多模态）识别手写内容 + 判错**：`server/src/routes/essay-grading.ts` 中 `callQwenVL`
   - 返回 `transcription`（作文原文）+ `errors[]`，每个 error 含 `original`（原文错误词）、`correction`（订正）、`type`、`explanation`、`wordIndex`/`line`
   - 满分 `max_score`（当前 15 分）
   - 响应可能被 markdown 包裹，必须容错提取 JSON
2. **PaddleOCR 官方 API 获取行级坐标并分割成词**：`server/src/services/paddleocr.ts`
   - 用 `@paddleocr/api-sdk`（Access Token 在 `server/.env` 的 `PADDLEOCR_ACCESS_TOKEN`）
   - 模型 `Model.PPOCRv5`，返回结构是 `page.prunedResult.{dt_polys(行级框)/rec_texts/rec_scores}`，**默认 `return_word_box:false` 只给行级**
   - 服务端自行把行文本按字符数比例分割成词级 bbox，返回 `WordBox[]`（字段 `text`/`bbox[x1,y1,x2,y2]`/`x`/`y`/`width`/`height`/`confidence`）
3. **图片标注**：`server/src/routes/essay-grading.ts` 中 `annotateImage`（sharp 拼接绘制）

### 关键踩坑（务必遵守）
- **base64 前缀**：前端会传 `data:image/jpeg;base64,...`，传给 PaddleOCR 前必须 `split(',')[1]` 去前缀，否则文件头损坏报"文件格式不支持"
- **annotateImage 参数顺序**：签名 `(imageBase64, errors, ocrWords)`，调用处必须传 `(compressedImage, gradingResult.errors, ocrWords)`，**不能**把 `ocrWords` 当第二参数（否则会把 OCR 词当错误遍历，original 全 undefined）
- **OCR 匹配防单字母误命中**：`findMatchingOCRWord` 先整段精确→再词级精确（长词优先）→最后包含匹配且仅限长度≥3 的词，避免 `"tell about".includes("a")` 误标
- **返回字段**：PP-OCRv5 的结果在 `prunedResult`，**不是** `detectionResults`（旧字段不存在，会导致解析 0 词）
- 千问返回的 `original` 可能是短语（如 `tell about`），按词级匹配到 OCR 单词即可
- **订正文字防溢出**：`annotateImage` 里订正词默认写错误词右侧，靠近右缘会画出画布被裁切。已加 `estimateTextWidth()` 估算文字像素宽度，右侧溢出自动转到左上方、再溢出转正上方居中；圆圈数字也从词上方改为左上方，并加顶部/左侧越界保护
- 完整链路自测脚本见 `server/test-grade.cjs`、`server/test-paddle*.mjs`（可删）

### 关键文件
- `server/src/routes/essay-grading.ts` - 批改主路由 + 千问VL + 标注
- `server/src/services/paddleocr.ts` - PaddleOCR 官方 API 封装 + 行→词分割
- `client/screens/essay-grading/index.tsx` - 批改前端页

### 四类批改标记（annotateImage，按 `error.errorType` 分支绘制）
千问 prompt 让每个 error 返回 `errorType`: `missing`/`wrong`/`extra`/`incomplete`，标注层按类型画不同红笔符号：
1. `extra`（多一个单词）→ 红色横线**穿过**该单词（删除线）
2. `missing`（少一个单词）→ 在原词（`original`=前一个词）右侧画插入符 `∧`，缺少的词写在插入符**上方**
3. `wrong`（改一个单词，else 分支）→ 单词**下方**画下划线，正确词写在线**下方**
4. `incomplete`（整句错误，`isSentence` 判定）→ `locatePhrase()` 框出整句，正确句子写在框**下方**

要点：
- `isSentence` = `errorType==='incomplete' || type==='sentence_structure'`
- **字体**：SVG 订正文字用 `font-family="DejaVu Sans, WenQuanYi Micro Hei"`（沙箱无 Arial；文泉驿微米黑支持中文批注列表）。没有 Noto CJK。
- 每个错误左上角画带圈序号 `seqNo` 与底部"批改标注"黄底列表对应（`[删]/[加]/[改]/[句]`）
- `locatePhrase` 在 OCR 词里按连续词序列匹配整句 bbox（找不到则退化为估算/词匹配）
- 图片底部用 `sharp.extend` + SVG `composite` 拼接黄底批注列表


- **判题必须拆细到单词级**：每个错误尽量用 errorType=missing/wrong/extra 指向**单个单词**（original=原词，correction=修正词），实现[加]/[改]/[删]精确标注；只有当整句确需重构时才用 incomplete（整句框+下方写正确句）。不要在长句里混入多个词错却整段报成 incomplete。
- **标注四类映射**（annotateImage 按 error.errorType 分支）：extra→删除线穿过词；missing→插入符∧画在 original(前一个词)右侧、缺词写上方；wrong→词下方下划线、correctioon 写线下方；incomplete→locatePhrase 取句子各词包围盒并集框整句、正确句写下方。isSentence=`errorType==='incomplete' || type==='sentence_structure'`。
- **SVG 字体**：订正/批注文字一律 `font-family="DejaVu Sans, WenQuanYi Micro Hei"`（沙箱无 Arial；文泉驿支持中文）。
