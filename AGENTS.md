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
10. **录题页面看不到标注图（根因 WebView 缓存，已修复）**：后端 `/recording-grade` 实测始终返回 `marked_images`（有效 jpeg base64），`server/public` 的 entry 也含最新渲染（总分卡下方紧跟 `h-[520px]` 标注图，再 show 评语），但鸿蒙 WebView/浏览器会缓存同名 entry JS，导致部署更新后仍显示旧 UI（无标注图 + 逐空列表截断）。**修复**：`server/src/index.ts` 静态资源中间件对所有响应加 `Cache-Control: no-store`（此前仅为 `max-age=0`，WebView 仍可能按启发式缓存命中），彻底杜绝复用旧 bundle。改完后需重新 `node build.js` + 单实例重启 `node dist/index.js`，并用 `curl -sI / | grep -i cache` 验证头为 `no-store`。
11. **数学公式显示为裸 LaTeX / 搜题报"图片无法识别"（已修复）**：两个根因。(a) 渲染：`MathView` 只认 `$...$`/`$$...$$`，后端返回裸 LaTeX（`\boxed{\dfrac{3}{2}}`）时被当纯文本转义。**修复**：`client/components/MathView.tsx` 增加 `normalizeMathDelimiters`——`\(...\)`/`\[...\]` 归一化为 `$`/`$$`；无 `$` 但含 LaTeX 命令时整段包成 `$$...$$`。(b) 解析：让模型输出 LaTeX 后，JSON 里未转义反斜杠中 `\frac`(\f)、`\boxed`(\b)、`\right`(\r)、`\text`(\t)、`\nu`(\n) 恰好撞 JSON 合法转义，`JSON.parse` 报 "Bad escaped character"，兜底成"图片无法识别"且**该失败结果还被缓存**。**修复**：`server/src/routes/solve-problem.ts` 的 `fixJsonLaTeX` 先用 `LATEX_ESCAPE_FIX`（负向后行断言）转义已知 LaTeX 命令反斜杠再修控制字符；读缓存忽略 `question_text==='图片内容无法识别'` 的占位行；写缓存跳过占位行。改后端必须 `node build.js` + 单实例重启才生效。
12. **长题（多问证明题）搜题仍报"无法识别"=模型输出被截断（已修复）**：症状为日志 `LaTeX fix also failed: Unterminated string ... position≈响应末尾`，即 JSON 尾部字符串未闭合=输出超 token 上限被拦腰截断。注意 `coze-coding-dev-sdk` 的 `LLMConfig` **不支持 max_tokens**（invoke 不透传，强加会 tsc 报错），不能靠调大 token。**修复**：`solve-problem.ts` 增加 `closeTruncatedJson` 截断自愈（扫描补未闭合引号+配对括号，salvaging 已完整字段）作为 LaTeX 修复失败后的兜底；prompt 要求 solution/analysis 简洁、并把 `answer` 字段顺序提前到 `solution` 之前（截断时保住答案）。解析失败时还会把原始/修复串 dump 到 `/tmp/solve_raw.json` 等供排查。
13. **AI 解答混入"不对/哦/我写错了"等自我纠正碎念（已修复）**：模型把思考过程泄漏进正式解答，不适合给学生。**修复**：`solve-problem.ts` 的 system/user prompt 增加"答题风格"硬约束——解答必须是严谨、肯定、可直接呈现给学生的最终版本，严禁自我怀疑/自我纠正/口语化碎念、严禁暴露思考过程。注意：esbuild 产物把中文转成**大写** `\uXXXX`，校验 dist 是否含新文案时要用大写转义或 node `includes`，直接 grep 中文/小写转义会误判为缺失。另：预览脚本在"服务已运行"分支只重建不重启，改后端后必须 `pkill -9 -f "node dist/index.js"` 再启动，否则跑旧代码。
14. **搜题模型从豆包 lite 改为直连千问 VL（qwen3.8-max，已修复/已切换）**
15. **详细模式复杂证明题输出失控→识别失败（已修复）**：`solve-problem.ts` 详细模式（`qwen3.8-max`）对多小问证明题会自主把 solution 膨胀到 ~15000 字符（日志大量"等等/我是否忽略了/修正思路"推翻重写碎念），逼近 token 上限被截断，JSON 修复（fixJsonLaTeX/closeTruncatedJson）全失败→前端"图片内容无法识别"，且耗时 145s。**修复**：a) 直连千问 fetch body 加 `max_tokens`（concise=4096、detail=6000）——之前 coze SDK 不支持 max_tokens 的限制不适用于原生 fetch，可加；b) 详细 prompt 新增"长度硬上限"（单题 JSON ≤4000 字符、多小题 ≤6000，多小问每题 solution 只写关键证明思路与结论、不逐条展开）。改动后 model 被迫在截断前收敛。改后端仍须 `node build.js` + pkill 重启（`bash scripts/coze-preview-run.sh` 完整重启）。
16. **搜题"同题答案每次不一样"根因排查（重要，已定位+部分修复，待配额恢复验证）**：用户反馈同一道解析几何压轴题（椭圆 `tan∠PQR` 最小值）三次答案不同。逐层排除：① 非模型问题——阿里云同图 max/flash 均稳定算出 `4√3`（正确值）；② 非图片压缩问题——原图与 sharp 压缩900/65 直连 flash 均正确；③ 根因有两点：(a) solve-problem 的 concise prompt 用"精炼/solution 3~6 步"限制，模型被迫跳步→高计算量压轴题算错 `(2)(ii)`（如 max 给出 `3√3/2`≠`4√3`）；(b) 缓存读取用 `eq(image_hash).limit(1)` 无排序，同图历史多条不同答案随机命中→每次答案不同。**已修复**：a) 移除 concise prompt 中"solution 3~6 步/精炼"限制，改为"完整严谨推导、逐步推出每个小问结论"（system 与 user text 同步改）；b) 缓存读取加 `.order('created_at',{ascending:false})` 取最新；写入改为同 `image_hash` 已有则 update 覆盖、无则 insert（避免同图累积多条）；c) `.env` 中 `QWEN_MODEL` 曾固化 `qwen3.8-max` 且代码默认也被 max 覆盖——已将 `.env` 改回 `qwen3.8-flash`，代码默认同 flash。**待验证**：改正后面临 `token-plan` API 配额耗尽（429，`09-26 01:47 UTC` 重置），flash 完整链路是否最终算对 `4√3` 需配额恢复后用 `bash scripts/coze-preview-run.sh`+`POST /api/v1/solve-problem` 实测。另注：此前所有"答案不同"实测多在 max 模型+skip-step 限制+cache 无排序三重叠加下发生，非单一模型不稳定。
17. **搜题"答案错误/同题不一致"最终根因与修复（已解决，q18 椭圆 tan∠PQR 题稳定 4√3）**：问题 16 判断的缓存/prompt 跳步虽也做了修复，但**并非答案错误的真正主因**。真正根因是 **solve-problem 的完整 system/user prompt 堆砌了大量干扰性强制条款**（尤其"若题目图片自带参考答案/小结，则 answer 必须与该标准答案逐项严格一致、解析必须收敛到它"这一条），严重抢占/诱导模型——同一张图、同一模型(qwen3.8-flash)、同一压缩图，仅 prompt 不同：完整链路稳定算错 `(2)(ii)≠4√3` 且每次都不同（`√3/3`、`5√3/18`、`16√3/15`、`4√3/9`），而**去冗余后的干净 prompt 稳定算对 `4√3` 且 (2)(i)=`y=√5/2(x+1)`**（与参考答案完全一致）。用户"阿里云干净 prompt 每次都对"完全吻合。**修复**（`server/src/routes/solve-problem.ts`）：把 system/user prompt 砍到"解题+公式 LaTeX 加 $ 包裹+不裸公式"的最小约束，**删除所有"与图片自带参考答案一致""严禁碎念/畏难措辞""长度硬上限""schema 字段逐条说明"等长规则**；模型直接返回自然语言解答（不再强制 JSON），后端在 JSON 解析链全部失败且输出非空时，将整段自然语言同时填入 `solution` 和 `answer` 兜底返回（前端 `answer`/`solution` 均为可选渲染，可正常展示）。`temperature` 0.1 压随机性，`max_tokens` 6000。**教训**：对高计算量压轴题，给多模态模型塞大量"风格/一致性/格式"约束会显著劣化其解题正确性——少即是多，若无需严格结构化就让其自然解题。：`solve-problem.ts` 原先用 `coze-coding-dev-sdk` 的 `LLMClient.invoke` 走扣子平台 `doubao-seed-2-0-lite-260215`；用户要求解题改用千问 3.8-max。**修复**：移除 `LLMClient/Config` import 与创建，改为 `fetch(chatUrl, POST)` 直连千问 OpenAPI（body `{model,messages,temperature:0.3,enable_thinking:false}`，AbortController 300s 超时），**完全复用作文批改的 `QWEN_API_KEY`/`QWEN_API_URL`/`QWEN_MODEL` env**（沿用 essay-grading 的默认 URL `…/compatible-mode/v1/chat/completions` 与默认模型 `qwen3.8-max`）；`messages`（system 题解老师 prompt + user 图片/文本）与后续 JSON 解析/LaTeX 修复/截断自愈兜底全部保留不变。URL 健壮化：若 `QWEN_API_URL` 不带 `/chat/completions` 会自动补。改后端必须 `node build.js` + pkill 重启；实测 `POST /api/v1/solve-problem` 日志 `调用千问 VL 模型: qwen3.8-max`、返回 `$x=5$` 正确。
18. **搜题结构化输出约束（已实现，不牺牲解题正确性）**：基于问题 17 的"干净 prompt"结论，在保持自然解题的前提下让模型在解答末尾输出"解析摘要"块：`====解析摘要==== / 结论：… / 点拨：… / 素养：… / 难度：L<1-6> /`（结束标记 `====摘要结束====` 可被模型省略）。**确保只加这段末尾摘要、不加其他干扰规则**，否则会重新劣化解题正确性。后端 `applySummary(q)`（`solve-problem.ts`）：从 solution+answer 中正则提取摘要（结束标记可选，`/...?(?:====摘要结束====|$)/`），把 `结论→answer`（**只含最终答案、无推导**）、`点拨→analysis`、`素养→core_competency`、`难度→difficulty`（格式化为 `L n`），并**反向剥掉 solution/answer 中的摘要块**（用 `/====解析摘要====[\s\S]*?(?:====摘要结束====|$)/`），保证返回给学生的是纯净字段（answer 只显示最终答案、answer 与 solution 计算一致）。**摘要块在非 JSON 兜底路径下依然存在**（模型按 system 要求输出），applySummary 在返回前统一对每个 q 执行。**难度体系由"简单/中等/困难"改为 L1-L6**：前端细目表改单独"学科核心素养 + 难度"区块（metaBlock/metaRow/metaLabel/metaValue/difficultyTextL 样式），移除原 specTable/difficultyEasy/Medium/Hard；`answer` 用 `MathView`（WebView+KaTeX）渲染、天然自适应屏宽。前端渲染顺序：题目→答案(仅最终结论)→解题思路点拨→解答→学科知识点+学科核心素养+难度→技巧→收藏。摘要块含"知识点"字段，解析回填 `knowledge_points`，与"素养"一起在素养区块（metaBlock）展示（`结论→answer / 点拨→analysis / 知识点→knowledge_points / 素养→core_competency / 难度→difficulty`）。验证（q18 椭圆 tan∠PQR 题，defer 缓存）：answer=`(1) x²/4+y²/3=1；(2)(i) √5x−2y+√5=0；(2)(ii) 4√3`，analysis=思路点拨，core_competency=数学运算/逻辑推理/直观想象，difficulty=L5，solution 无摘要残留，2/2 稳定。改前端后需 `cd client && npx expo export --platform web && rm -rf ../server/public && cp -r dist ../server/public` 才有新 UI。
19. **搜题支持多文件上传（已实现）：图片多张 + PDF + Word(.docx)**：搜题不再限单图。后端 `solve-problem.ts` 路由从 `upload.single("image")` 改为 `upload.array("files", 20)`（同时兼容旧 `image` 单字段），新增 `parseDocText(buffer, mime, filename)`：PDF 用 `pdf-parse@2` 的 `PDFParse` 类（`require("pdf-parse")` 取具名导出，`new PDFParse({data})` + `getText()`，注意 v2 非默认导出、非旧 v1 函数式 API）、DOCX 用 `mammoth.extractRawText({buffer})`；新增 `isImageMime()`。多文件按 mimetype 分流：图片 → sharp 压缩 900/q65 后以 `image_url` 数组全部喂模型（多图拼接）；PDF/DOCX → 提取文本拼入 userPrompt 的"[PDF/Word 内容]"块。**聚合 hash**（多文件 buffer 拼接）作缓存键。前端 `search/index.tsx`：`imageUri` 单图 state 重构为 `files: SearchFile[]`（`{uri,name,type,isImage}`），相册支持多选、文档选择支持多文件（图片/PDF/DOCX），FormData 追加多个 `files` 字段；多文件网格预览（图缩略图/文档图标 + 单个删除 `handleRemoveFile` + 清除重选 `handleReselect`）。**收藏仍只传** `files` 中第一张图片（`getDocumentAsync` 的返回 `DocumentPickerAsset` 无 `.type` 属性，isImage 用文件名扩展名正则判断，不能读 `.type`）。验证：多图（上半+下半两张拼成题目）稳定算出完整正确 `(2)(i)/(2)(ii)`；图片+DOCX 混合正确。注意 `docx` 依赖用于**后端生成测试 docx**（`Document/Packer`），不是解析（解析用 mammoth）。

20. **搜题多文件继续优化（已实现）**：
   - **上传后不自动搜题，改"开始搜题"确认按钮**：前端选中文件后仅进入待命态（可继续"添加文件"、可删除单个文件），点"开始搜题"按钮才按当前精炼/详细模式发起解析；有结果或加载中时隐藏按钮。避免误触、便于一次性集齐多文件再搜。
   - **缓存元字段兼容**：旧版本缓存的 `analysis`/`knowledge_points`/`core_competency`/`difficulty` 可能为空（前端条件渲染导致"解题思路点拨/解答/素养/难度"等区块消失）。后端缓存命中时先构造 q 并 `applySummary` 尝试从缓存 solution 补齐；若 `answer` 缺失或三元字段全空（`!metaComplete`）则判定为脏缓存，忽略并重新走 LLM 拿完整结构化结果、覆盖重建缓存。前端区块按字段存在性渲染（`q.analysis &&`、`q.difficulty &&` 等），空字段即隐藏对应区块。

21. **手机浏览器注册页密码框软键盘"闪一下消失"无法输入（已修复/纯 JS 方案，不依赖新特性）**：症状为手机浏览器（华为鸿蒙/小米异常，iQOO 老版正常，电脑正常）直连 Railway 后，注册页点"设置密码"时软键盘闪一下消失、无法输入。**根因（playwright 移动端实测定案）**：新版手机浏览器默认 `interactive-widget=resizes-visual`——软键盘**悬浮弹出、布局视口保持原高（844）不变**，而 RN Web reset（`html/body/#root{height:100%}` + `body{overflow:hidden}`）把整页钉死在视口高、内容永不溢出、无原生滚动能力；密码框（top≈441-527）被键盘物理盖住又无法滚到可见 → 系统判定 input 不可见而收键盘。手机号框（top≈180）在键盘上方可见所以正常；iQOO 老版自动 `resizes-content`（键盘弹出时布局视口收缩、RN ScrollView 高度随之变小、内容溢出可滚）所以正常。**修复（双保险，核心是纯 JS、不依赖浏览器新特性）**：`server/src/index.ts` 的 `serveIndexHtml()` ① 把 viewport meta 替换为带 `interactive-widget=resizes-content` 的版本；② **注入 `KEYBOARD_FIX_SCRIPT`**（`</head>` 前、仅移动端启用）：监听 `visualViewport.resize`/`onresize`/`focusin`，当 `visualViewport.height < window.innerHeight`（软键盘弹出，keyboard 会缩小可视视口）时把 `#root` 高度压到 `visualViewport.height`，RN 内层 ScrollView 高度随之变小、内容溢出获得滚动能力，再 `scrollIntoView({block:'center'})` 把聚焦 input 滚到可见——等效于强制 old 浏览器行为，但无需浏览器支持 `interactive-widget`。统一用于 `/`、`/index.html`（static 之前拦截中间件）与 SPA fallback（`*`），带 `Cache-Control: no-store`。**验证**：playwright 模拟 vv 844→460（innerHeight 保持 844，resizes-visual 语义）后 #root 被压到 460px、ScrollView sh696>h460 可滚、密码框 activeRect 落于可视区；`pnpm lint:all`/探活/健康检查通过；脚本加载与聚焦均无 JS 报错。**其他前置修复保留为双保险/优化**：`client/components/Screen.tsx` Web 端普通 ScrollView + `focusin` 滚动监听；register 密码框 `autoComplete="new-password"`。注意：`app/+html.tsx`/`web-static/index.html` 对 SPA export（`output='single'`）**不生效**（expo 用内置 `@expo/cli/static/template/index.html` 模板），必须走 server 运行时注入；改后端仍须 `node build.js` + pkill 重启。另注意 `npx expo export` 覆盖 dist 会**清掉手动补的 KaTeX 字体**（`dist/_expo/static/css/fonts/`），重新导出需 `mkdir -p dist/_expo/static/css/fonts && cp node_modules/katex/dist/fonts/* dist/_expo/static/css/fonts/` 再同步 server/public。**若真机仍无效**：用快捷方式重开沙箱再部署（Expo CLI 的 `interactive-widget` 兼容面有限但 JS squash 应通用），并在真机上 `chrome://inspect` 看聚焦时 `#root.style.height` 是否被压到 ~可视高。**回归修复（验证码不再闪）**：首版 JS 脚本对**所有** input 都执行 squash + `scrollIntoView({block:'center'})`，会把中上部本不需滚动的验证码框（top 267）居中顶到 208，真机表现为"输入验证码也闪一下"。已修复：`reveal()` 增加守卫，仅当 `rect.bottom > visibleH-8 || rect.top < 0`（input 确被键盘遮挡）才居中滚动；验证码聚焦时保持位置静止（playwright 复测：验证码 top267 不变，密码框 bottom 460 正常滚到可视区）。**真机反馈机制（诊断浮层，供用户排障反馈）**：无法真机还原键盘现场时，`KEYBOARD_FIX_SCRIPT` 注入右下角浮动 `#kbDiag` 指示条——任何 input 聚焦或 vv resize 时实时显示现场数据（`type/ph/rectTop/rectBottom/visibleH(vv.height)/innerH/inté \`innerHeight\`/need(是否被键盘遮挡)/rootTarget(是否 squash 触发)/rootH`），点击展开 `data-full` 多行；供用户把真机上的显示内容反馈回来定位。**esbuild 转义陷阱（必坑）**：`KEYBOARD_FIX_SCRIPT` 是一个 esbuild 打包的模板字符串，段内**任何** `\n` 转义（如 `lines.join('\\n')`）都会被 esbuild 在构建产物里**转成真实换行夹在 `'...'` 里**，导致注入后页面 inline script 语法错误（页面 JS 完全失效、白屏/键盘问题不修而返）。**规避**：段内不可用 `'\\n'`/`'\\u2026'` 之类的转义序列，改用 `String.fromCharCode(10)`、直接写 ASCII、或用不含反斜杠的写法；校验：`node --check` 或用 `new Function()` 跑 `dist/index.js` 里提取的注入脚本，必须 SYNTAX OK。

## 首页（study/index.tsx）简化

- **顶部**：保留大图背景 `iconRock` + 右上角四个功能按钮（搜索/历史/能力地图/添加），按钮与功能不变（`searchButton` 半透明圆底）。
- **去掉了刻字（engrave）功能**：不再渲染 `iconRock` 上的刻字文字展示，也不再点击跳 `/engrave`。
- **下半区**：由 2×2 图片网格（regionA/regionB/region4Bg/my-vocab 图片图标）改为简洁文字卡片（词汇学习/学习日历/个人中心/我的词汇书），保留全部跳转与登录判断。
- **已清理**：不再使用的大图资源 require（`regionAImg/regionBImg/region4Bg/iconMyVocab`）、`engravedText*`/`regionAStyle`/`gridImageFull` 等样式、`useSafeSearchParams`。
- **补齐历史缺失样式**：modal 弹窗引用的 `modalHeader`/`modalBody`/`modalCloseBtn` 在 HEAD 即缺失（运行时仅样式缺省不崩、但 tsc 报错），已补定义。
- **type 修复**：`emotionDistribution`/`gazeDistribution` 的 `Object.entries(...)` 在新版 TS 推断 `count` 为 `unknown`，改为 `as [string, number][]`。

## 首页（study/index.tsx）简化

- **顶部**：保留大图背景 `iconRock` + 右上角四个功能按钮（搜索/历史/能力地图/添加），按钮与功能不变（`searchButton` 半透明圆底）。
- **去掉了刻字（engrave）功能**：不再渲染 `iconRock` 上的刻字文字展示，也不再点击跳 `/engrave`。
- **下半区**：由 2×2 图片网格（regionA/regionB/region4Bg/my-vocab 图片图标）改为简洁文字卡片（词汇学习/学习日历/个人中心/我的词汇书），保留全部跳转与登录判断。
- **已清理**：不再使用的大图资源 require（`regionAImg/regionBImg/region4Bg/iconMyVocab`）、`engravedText*`/`regionAStyle`/`gridImageFull` 等样式、`useSafeSearchParams`。
- **补齐历史缺失样式**：modal 弹窗引用的 `modalHeader`/`modalBody`/`modalCloseBtn` 在 HEAD 即缺失（运行时仅样式缺省不崩、但 tsc 报错），已补定义。
- **type 修复**：`emotionDistribution`/`gazeDistribution` 的 `Object.entries(...)` 在新版 TS 推断 `count` 为 `unknown`，改为 `as [string, number][]`。

## 搜题多图归并 + 结果左右滑动分页（search 页）

- **需求**：多张照片有时是同一道题的上下/连续两半（需合并成一道完整作答），有时是完全不同的多道题（需分开，各自一"页"）；结果区要支持左右滑动（右划下一题/左划上一题）。
- **后端**（`solve-problem.ts`）：多文件循环已把图片压缩为多个 `image_url`、文档提取文本拼入 userPrompt；prompt 引导模型先判断多图是"同题连续/下半"（合并进同一个 `question` 元素、含各小问）还是"不同大题"（拆成多个 `question` 元素，一个元素只含一道题）。多文档/图片的聚合 hash 作缓存键。
  - **已知局限**：干净 prompt 下，模型对"完全无关的两张不同科目图"仍可能合并成单个 `question`（answer 里写"第一题…第二题…"）。这是"少约束保正确性 vs 强制结构化"的固有 trade-off，前端单页也能完整展示，不丢内容。
- **前端**（`search/index.tsx`）：多题结果（`result.questions.length > 1`）改为**横向分页**——`ScrollView horizontal pagingEnabled`，每页宽度=屏宽-32，一页一道题卡片；顶部 `pagerHeader` 显示"第 N / M 题" + 左右箭头，配合 `onMomentumScrollEnd` 根据 `contentOffset.x / winWidth` 更新 `activePage`。单题保持竖向列表。耗时：用 `useWindowDimensions().width` 取屏宽；卡片逻辑抽为 `renderQuestionCard(q, index)` 复用。

## 搜题多图"按题号分卡"重构（solve-problem 逐图独立调用）

- **问题**：多图一次调用时模型常把两张不同题号图合并进同一个 `question`，且解答区夹杂"这两张图片分别展示了…"这类无法拆分出干净单题字段的废话；独立题无法可靠分页展示。
- **修复**（`server/src/routes/solve-problem.ts`）：多图改为**逐张独立调用模型**——`imageParts.length > 1` 时对每张图单独构造一个 `image_url` + `userPrompt` 调 `solveOnce(contentItems)`，各自返回该图内含的所有独立题，累加进 `result.questions`；单图/纯文档仍单次调用。模型调用+JSON 解析（markdown 提取/控制字符/LaTeX 反斜杠/截断自愈兜底）封装进 `solveOnce` 复用，返回 `result`（含 questions 数组）。彻底规避多图合并，天然"一图一题"、每题字段齐全，前端第N/M题的箭头分页可逐题完整展示。
- **摘要模板占位符**：`systemPrompt` 的"解析摘要"格式模板删掉了尖括号样板（`<2~4 句…>`、`如 L3` 等）——模型常照抄模板样板到"点拨/难度"里，改为纯描述性写法（"用2到4句话写出…"、"以 L 加一位数字取值 L1-L6"）。
- **验证**：两题两图 → 2 个独立 question（各含 answer/analysis/素养/难度/知识点），无占位符、无"这两张图片"废话；单图 → 1 题正常；空请求 → 400。改后端须 `node build.js` + pkill 重启。

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
0. **腾讯云「中英文手写作文识别」HandwritingEssayOCR（词级坐标，默认优先）**：`server/src/services/tencent-ocr.ts` 的 `callTencentOcr(imageBase64, lang)`
   - 按 `subject` 选 `ConfigId`：英语 `ArticleRecognizeEng`、语文 `ArticleRecognizeCmn`
   - 返回 `WordList[]`（按行分块）+ 行内 `WordCoord[]` 即**逐词精确坐标**（`Coord.LeftTop/RightBottom`，y 向下为正），空格天然切词、标点单独成块、连笔词也能贴字分割——正是"上下紧贴 + 按空白聚合 + 提供坐标"的方案
   - **纯 HTTP 无本地模型，可部署 Railway**；凭证 `TENCENT_SECRET_ID`/`TENCENT_SECRET_KEY`（`server/.env`，gitignore）
   - 引擎开关：`OCR_ENGINE` env（默认 `tencent`；`paddle` 回退旧 PaddleOCR 链路），腾讯云失败自动回退 `callPaddleOCR`
1. **千问 VL（qwen 多模态）识别手写内容 + 判错**：`server/src/routes/essay-grading.ts` 中 `callQwenVL`
   - 返回 `transcription`（作文原文）+ `errors[]`，每个 error 含 `original`（原文错误词）、`correction`（订正）、`type`、`explanation`、`wordIndex`/`line`
   - 满分 `max_score`（当前 15 分）
   - 响应可能被 markdown 包裹，必须容错提取 JSON
2. **本地 PaddleOCR 词级框（优先）→ 云端回落**：`server/src/services/paddleocr.ts`
   - **优先本地**：`callPaddleOCR` 用 `child_process.execFile` 调 `server/ocr-service/ocr_local.py`（venv 为 `ocr-service/.venv`，Python 3.12），一次性（非常驻服务）识别，避免手动服务被沙箱回收
   - `ocr_local.py` 用 `PaddleOCR(lang='en', use_angle_cls=True)`。**已改为"按空白切词"方案**：det 只给行级框，对每行内部做**列方向墨迹投影**，按单词间**真实空白 gap** 切出词块，tight bbox 从字迹像素精确计算（上下左右紧贴），输出 `{text,bbox,x,y,width,height,score}`（见下方"本地 PaddleOCR 词级框方案"）
   - **失败自动回落云端**：`runLocalOCR` 异常时回退 `getClient.extractDocument`（`@paddleocr/api-sdk`，云端 token 已兜底写死在代码 `paddleocr.ts`，见下文"部署踩坑"），PP-OCRv5 只给行级 `prunedResult.{dt_polys/rec_texts/rec_scores}`，再由 `splitRowByCharRatio` 把行文本按字符数比例切词
   - 统一返回 `WordBox[]`（字段 `text`/`bbox[x1,y1,x2,y2]`/`x`/`y`/`width`/`height`/`confidence`）
3. **图片标注**：`server/src/routes/essay-grading.ts` 中 `annotateImage`（sharp 拼接绘制）

### 本地 PaddleOCR 词级框方案（essay-ocr-local）
> ⚠️ **当前定位**：腾讯云 HandwritingEssayOCR（见流水线第 0 层）已是词级坐标主引擎；本地 PaddleOCR（本段）+ 云端 PP-OCRv5 仅在腾讯云不可用时作为回退（`OCR_ENGINE=paddle` 或腾讯云抛错时自动回落）。本段保留作为回退链路的实现知识。
- **为什么本地化**：云端 `@paddleocr/api-sdk` 的 `return_word_box` **实测无效**（v5/v6 都只返回行级 `dt_polys`，`rec_polys==dt_polys`）；PaddleOCR-VL-1.6 大模型调用极慢（几十秒起、易超时 422）。标注要精确贴合单词，必须拿到词级框。
- **运行方式**：`ocr_local.py <图片路径>`，stdout 首行 meta `{ok,count,...}`，其后每行一个词 JSON `{text,score,box[4点]}`；`PaddleOCR` init 日志在 stderr 不影响解析
- **venv 位置**：`server/ocr-service/.venv`，Python 3.12 + paddlepaddle 2.6.2（CPU，Paddle CDN 源 `-i https://www.paddlepaddle.org.cn/packages/stable/cpu/` 装）+ paddleocr 2.9.1
- **版本地狱（务必保持，否则 import 崩）**：`numpy==1.26.4` + `scipy==1.11.4` + `albucore==0.0.13` + `albumentations==1.4.10`。imgaug 会把 numpy 拉回 2.x→需最后 `--force-reinstall --no-deps numpy==1.26.4`；scipy 新版在 numpy<2 下报 `np.long`→要 scipy 1.11.4；albucore 新版要 torch→钉 0.0.13
- **模型缓存**：首跑会自动下载 det/rec 模型到 `~/.paddleocr`，之后 init 约 0.6s、识别约 2s
- **注意**：paddleocr 2.9 的公开 API 是 `ocr()`（无 `predict`/`return_word_box` 参数）；实测 det 对英文无论 unclip ratio 多小都合并成行级框（`hello world` 一个框），**必须自己按空白切词**，不能依赖 DB 拆词。
- **按空白切词（当前本地方案）**：`ocr_local.py` 里对每个 det 行框，垂直方向在行 band 内做列墨迹投影（`mask>0` 计数），gap 宽度 ≥ `max(4, round(bh*0.28))` 视为词间空白切分点；多块再按其文本 token 合并；tight bbox 用 `cv2.findNonZero` 精确包络（上下左右贴字，无 0.72 收缩）。node 侧 `splitLocalWords` 只要见到 `x`+`width` 字段就**直接采用**紧贴框，不再量比例。**参数目前用合成印刷体微调，真实手写需用真实作文图校准（词间距更宽，应更准）。**
- **app.py 接线顺序（已恢复 import.meta.url）**：node 侧 `paddleocr.ts` 里 `localOcrPaths()` 定位 ocr-service 用 `import.meta.url`（esbuild 产物 `format:'esm'` + `"type":"module"`，**函数内 `__dirname` 不可用**，否则抛 `__dirname is not defined` 导致整个 OCR 失败）。
- **⚠️ 沙箱会反复清空 `.venv`（bin/lib 全没）与 `~/.paddleocr`**：被清后 `localOcrPaths` 判定"本地 OCR 环境未就绪"，本地 OCR 静默回退云端 PP-OCRv5 行级粗切——**标注回到"线穿过下一行 / 词框并词"的老样子，看起来就跟 cloud 版一模一样**。排错先查 server 日志是否有 `回退 cloud PaddleOCR`。一键重建：`bash server/ocr-service/setup_local_ocr.sh`（重建 venv + 重装依赖 + imaug __init__ patch，模型也会重新下载）。

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

## 新增功能：批改设置（科目选择 + 满分分值）

- **批改/扣分标准对全科目开放（含作文）**：前端 `essay-grading/index.tsx` 的"打分标准"输入框不再仅限 `subject==='other'`，对所有科目显示；作文科目（英语/语文）文案为"批改标准（扣分规则，可选）"，placeholder 示例"一个语法错误扣1分、一个句型错误扣1分、跑题扣5分"。请求体 `grading_standard` 本就全科目上送。后端 `essay-grading.ts` 作文分支 prompt 新增 `## 批改标准（扣分规则）` 段（消费已传入的 `gradingStandard`），并在中/英作文评分要求里加"若提供批改标准则扣分优先按其规则执行、落实到对应维度分并在评语说明依据"。作文总分仍=四维封顶求和，扣分通过影响各维度分体现。注意：Metro web bundle 中文用**小写** `\uXXXX` 转义（区别于 esbuild 的大写），校验前端产物时用小写转义。

- **前端** `client/screens/essay-grading/index.tsx`：批改前增加"作文科目"（英语作文/语文作文）与"满分分值"输入框。切换科目时满分自动给默认值（语文 40、英语 15，用户可改）。请求体带 `subject`('english'|'chinese') 与 `max_score`。
- **后端** `server/src/routes/essay-grading.ts`：
  - `/grade` 接收 `subject`。`callPaddleOCR(compressedImage, ocrLang)`，语文传 `'ch'`，英语 `'en'`。
  - `callQwenVL(..., subject)` 内按科目构造不同 prompt：语文教师识别错别字/病句/标点/用词/表达，评分维度"内容/语言表达/结构/卷面书写"；错误类别 type 仍用现有枚举（spelling=错别字、grammar=病句搭配等），errorType 四类标记语义不变。
- **中文 OCR**（`server/src/services/paddleocr.ts`）：`lang === 'ch'` 时**跳过本地**、直接走云端 PP-OCRv5（其模型原生支持中英混排；本地 `.venv` 的 lang='en' 模型不认中文，且本地中文模型在沙箱下载不稳定）。英语保持"本地词级框优先 → 云端回退"。语文作文标注因此是**行级框**（云端返回整行，按字符比例切分多词场景有限），错字/病词定位到整行区域，具体哪个字由批注列表说明。
- **中文标注**：`estimateTextWidth` 对汉字按全角计宽；SVG 字体 `DejaVu Sans, WenQuanYi Micro Hei` 支持中文；annotateImage 的标点跳过判断 `/[A-Za-z\u4e00-\u9fa5]/` 已兼容汉字。无需额外改动。
- **定档与分数强一致（服务器端强制，essay-grading.ts total 计算后）**：模型会在输出 JSON 返回 `tier:{name,min,max}`（刻度区间）。为避免"评语写第三档(7-9)但实际打 10 分"的评语/分数脱节，服务器把 `total_score` 钳到 `[tier.min,tier.max]`∩`[0,max_score]`，再把各维度(scores.content/language/structure/handwriting)或得分点(points)按比例缩放到与该钳制后的 total 之和精确相等（最后一项=total-已累加，保证和一致）。`tier` 归一化在读取 `g.tier` 时完成（`g.tier && Number.isFinite(min)&&Number.isFinite(max)` 才保留）。改后端需 `node build.js` + pkill 重启生效；查评分证据看日志 `[grade] 模型返回 total=… 定档=…`。
- **自定义维度优先显示（essay-grading.ts 作文 prompt"如何使用上面的标准"）**：只要评分标准里出现**并列的维度清单**（如 内容要点/词汇语法/篇章连贯，**无论是否附分值**），就按这些维度逐项打分输出 `points`（point=维度名），前端 `index.tsx` 对任意科目 `points.length>0` 即优先渲染该列表，固定四维卡仅兜底；标准未给各维满分时由模型把 max_score 分配到各维 max（总和=max_score）。别误判"没给分值=不走维度"，维度名才是触发点。
- **评语·错误·分数三角一致（essay-grading.ts 作文 prompt"定档与分数强一致"段）**：模型会先按错误多少/严重度定档（错误越多越基础越影响理解→档位越靠下并取档内下限附近分），且评语对缺点的定性措辞必须与所给档位/分数严格匹配——评语写了"大量拼写错误、严重语法错误、严重影响理解"就只能落在偏低档（高考五档=第二档 4-6 及以下）；给中高分则评语只能表述为"有若干不足但基本完成任务、基本不影响理解"。禁止"评语严厉批评却给中高档"或"淡淡批评却给低分"。触发背景：用户反馈"评语里说大量严重错误怎么还有9分"（第三档上限9与其严重评语脱节）。
- **批量批改结果导出为 Word（server/src/routes/essay-grading.ts `/export` + client/screens/batch-grading/index.tsx）**：批量批改结果区新增"下载批改结果（Word）"按钮（蓝色 downloadButton），前端把已批改的 `results`（filter：仅 `result && !error` 的项）POST 到 `POST /api/v1/essay-grading/export`（body `{results, title}`），后端用 `docx` 库（server 依赖，已装 ^9.7.1）生成 .docx（含每篇总分/得分维度或 points/评语/错误订正/亮点/改进建议，中文字体 SimSun），返回 `attachment` 文件，前端在 web 端用 `URL.createObjectURL`+`<a download>` 触发下载。**导出仅 web（Platform.OS==='web'）可用**，非 web 环境 Alert 提示"请在网页预览中使用"；改成 `batch-grading/index.tsx` 需重新 `npx expo export --platform web` + 复制到 server/public + 补 KaTeX fonts 才生效。顺带修了 `ImageItem.base64` 允许 null（image picker 类型）。。
- **批量批改结果展示补齐（client/screens/batch-grading/index.tsx）**：用户反馈"批改结果显示的内容减少的项目加回来"——批量页结果卡原先只有总分+固定四维+单张标注图+评语，已补齐为与单篇页一致的完整展示：① 原文转录（`transcription`，有则显示）；② 总分后追加定档 `tier.name` 徽标（`scoreTier`）；③ 维度优先渲染自定义 `points`（`p.point||p.name`+`p.score`），无自定义维度才回退固定四维（内容/语言/结构/书写）；④ 新增"错误详情"列表（`getErrorTypeName`/`getErrorTypeColor` 徽标 + original/correction/explanation）；⑤ 评语；⑥ 优点（strengths 列表）；⑦ 改进建议（improvements 列表）。`GradingResult` interface 补齐 `transcription?`/`points?`/`tier?` 及其 errors 的 `errorType?`。新增 styles：`scoreTier`/`errorItem`/`errorHeader`/`errorBadge`/`errorBadgeText`/`errorOriginal`/`errorCorrection`/`errorExplanation`/`bulletText`。前端二次导出注意：`npx expo export` 可能 exit 127（client/.bin/expo 缺失），改用 `node client/node_modules/expo/bin/cli export --platform web`；Metro web bundle 中文以小写 `uXXXX` 转义，validate 用 grep 单看某字（如 `grep -c 'u9519'` = “错”）。。

## 新增功能：AI 主观题批改 + 其他学科（按参考答案+打分标准逐点评分）

- **定位**：入口文案"AI 作文批改"升级为"AI 主观题批改"（`study/index.tsx`），页面标题同步"主观题批改"；批改界面科目从"英语作文/语文作文"扩展为三选：**英语作文/语文作文/其他学科**（`subject`: `'english'|'chinese'|'other'`）。
- **前端** `client/screens/essay-grading/index.tsx`：
  - `switchSubject` 支持 `'other'`；其他学科默认满分可改，且**允许多图**（与其他学科/语文一致，不受英语 1 页限制）。
  - 科目 UI 加"其他学科"按钮；`subject==='other'` 时额外显示**"打分标准"**多行输入框（state `gradingStandard`），并把"参考答案"标签强调为参照。
  - 请求体带 `{ images[], subject:'other', grading_standard, reference_answer, max_score }`。
  - `GradingResult` 增加可选 `points: { point, max, score, comment }[]`（得分点）。结果展示：`subject==='other'` 时渲染**得分点列表**（pointsContainer/pointItem/pointBadge 序号+pointTitle 要点+pointScore 得分/满分+pointComment 点评）与总分；四维分数卡片（内容/语言/结构/书写）与标注图仅作文科目显示；错误改错列表按 `errors.length>0`（其他学科 errors 为空则隐藏）。
  - 样式需补齐 points 一组（pointsContainer/pointItem/pointBadge/pointBadgeText/pointTitle/pointScore/pointScoreValue/pointScoreMax/pointComment），否则运行时 `undefined is not an object` 白屏。
- **后端** `server/src/routes/essay-grading.ts`：
  - `/grade` 请求体读取 `subject`、`grading_standard`、`reference_answer`、`max_score`；`ocrLang`：`chinese`→`'ch'`、其他（`english`/`other`）→`'en'`。
  - `callQwenVL(..., subject, grading_standard)`：`subject==='other'` 时构造"学科主观题批改教师"prompt，要求依据 `reference_answer`+`grading_standard` **逐点评分**，输出 `points:[{point,max,score,comment}]`（不找错字、不输出 errors/四维 scores）。
  - 总分计算：`subject==='other'` 时 `total_score = sum(points.score)`（不走作文四维配权）；标注跳过 annotateImage，`marked_images` 直接返回每页压缩原图（无红笔）；保存 original/marked 同作文格式。

## 新增功能：多页批改（语文作文可多张图，最多 3 页）

- **前端** `client/screens/essay-grading/index.tsx`：图片选择由单张改多图。state 用 `selectedImages: string[]`（替代 `selectedImage`）、结果用 `markedImages: string[]`（替代单张 `markedImage`）。语文最多 3 张（`MAX_PAGES`），英语 1 张。已选图缩略图行 + "添加页面/继续添加"按钮 + 每张可移除（`removeImage`）。请求体把每张 uri 读成 base64 后提交 `images[]`。
- **结果展示**：`data.data.marked_images` 为每页一张批改图数组；前端用横向 `ScrollView` 分页（`pagingEnabled`）+ 页码圆点（`pageDots`/`pageDot`）左右滑翻页查看；页码指示"第 X / N 页"。
- **后端** `server/src/routes/essay-grading.ts` `/grade`：
  - 请求体改为 `images[]`（兼容旧 `image` 单字段自动兜底为数组），`imageList = imageList.slice(0, MAX_PAGES)` 限 3 张。
  - **逐页 OCR**：每页独立 `compressImage` + `callPaddleOCR(compressed, ocrLang)`，得到各页 `ocrWords`；同时把每页词**追加进全局词表 `allWords`**，记录每页起始序号（`pages[].start`），`wordIdx` 用**全局跨页序号**。
  - **整体评分**：`joinedTranscription = reconstructText(每页words)`（按行聚合计权拼成整篇文本）传入 `callQwenVL(imageList, joinedTranscription, ...)`，让千问基于**拼接后的完整作文**统一评分判错（不再逐张单独评），transcription 以后端拼接文本为准。
  - **分页标注**：`assignErrorsByPage(errors, pages, allWords)` 把每个 error 的全局 `wordIdx` 映射到所属页并把索引改成页内；若 wordIdx 缺失则用 `findMatchingOCRWord` 逐页文本匹配定位（仍未命中放第 0 页）。再对**每页分别** `annotateImage(页图, 页errors, 页words)`，返回 `marked_images: string[]`。
  - 响应 `data.data = { grading, marked_images, id }`。存储时 original/marked 以 JSON 数组存多张。
- **重建文本** `reconstructText`：按 y 坐标分行为行、行内按 x 排序聚合词文本，行间换行，形成该页可读文本；用于喂千问整篇评分。
- **注意**：wordIdx 约定为**跨页全局连续编号**（第 2 页词在全局序号续接第 1 页），千问返回时按全局 index；`assignErrorsByPage` 依据 `pages[].start` 区间换算页内索引，勿把全局 index 直接当单页词表下标。

## 服务稳定性踩坑（多进程堆积导致 5000 端口无法连接）
- **症状**：反复 build/重启后，`ps aux | grep "node dist/index.js"` 会累积出多个 node 进程同时抢 5000 端口，导致连不上后端/预览一直"启动中"。esbuild build 后 nodemon 每次重启都可能叠加新进程。
- **修复**：启动前先 `pkill -f nodemon` 并逐个 kill 残留的 `node dist/index.js`，确认 `ss -tlnp | grep 5000` 只剩唯一进程，再 `setsid nohup node dist/index.js > /tmp/server-dev.log 2>&1 &` 单实例启动。
- **检查命令**：`ss -tlnp | grep 5000`（应只有 1 个 pid）；`ps aux | grep "node dist/index.js" | grep -v grep | wc -l`（应为 1）。

## 部署踩坑（Railway 云端 PaddleOCR token）

- **问题**：Railway 部署后报 `PADDLEOCR_ACCESS_TOKEN 未配置`（500），沙箱正常。原因：`server/.env` 被 gitignore 不进构建，token 只能靠 Railway 环境变量注入。
- **定位铁证**：访问 `/api/v1/env-check`（server/src/index.ts 新增的诊断接口，只返回各关键 env 是否存在、不打印值），发现 `QWEN_API_KEY`/`COZE_SUPABASE_*` 均为 true、唯独 `PADDLEOCR_ACCESS_TOKEN` 为 false —— Railway 变量注入正常，是该变量被加到了非 Production 的 Environment/Service。
- **最终方案（已固定）**：`server/src/services/paddleocr.ts` 中 `const token = process.env.PADDLEOCR_ACCESS_TOKEN || '5332cbc5f8c27b2ee620aad7be63b2414c3e4003';` 把云端 PaddleOCR token 作为代码兜底默认值（该 token 视为可公开凭证，与项目中 Supabase key 硬编码方式一致）。这样无论 Railway 是否注入该变量都不会再报"未配置"。

### 部署踩坑（腾讯云 HandwritingEssayOCR 凭证）
- **问题**：Railway 部署后腾讯云 OCR 整体失败。原因：`TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY` 在 `server/.env`（gitignore，不进构建），Railway 上只能靠环境变量注入；未注入时 `getClient()` 抛 `TENCENT_SECRET_ID / TENCENT_SECRET_KEY 未配置`，批改路由捕获后回退 PaddleOCR。**部署前务必确认 Railway Production 的 Variables 里配好这两个变量**（en.bind变量在 Service → Variables 新增，而非固定在某个 Environment）。
- **域名**：endpoint 固定 `ocr.tencentcloudapi.com`；区域默认 `ap-guangzhou`（可用 `TENCENT_OCR_REGION` 覆盖）。
- **费用**：HandwritingEssayOCR 计费（约 0.36 元/次，含免费额度），在线调试/每次批改都是真实调用计费，部署前提醒用户留意。

## 线上批改白屏根因与修复（essay-grading 稳定性）
- **症状**：Railway 部署后批改页面白屏，控制台 `TypeError: Cannot read properties of undefined (reading 'length')`、批改失败 500 `无法解析千问 API 返回的 JSON`。
- **根因 1（前端渲染崩溃）**：千问(Qwen)返回的 `grading` 可能缺 `errors/scores/strengths/improvements` 等字段（尤其 `subject==='other'` 不输出 errors/四维 scores），而 `client/screens/essay-grading/index.tsx` 渲染时直接 `gradingResult.errors.length`、`gradingResult.strengths.length`、`gradingResult.improvements.length`、`gradingResult.scores.content`，对 undefined 读属性 → React 渲染中断 → 白屏。
- **修复（前端）**：对所有可能缺失字段加空值保护——`(gradingResult.errors ?? [])`、`(gradingResult.strengths ?? [])`、`(gradingResult.improvements ?? [])`、`gradingResult.scores?.content`，以及 `renderTranscriptionWithErrors(..., gradingResult.errors ?? [])`。markedImages 已由 `|| [...]` 兜底为数组，无需改。
- **根因 2（后端字段不完整）**：`server/src/routes/essay-grading.ts` 的 `callQwenVL` 返回前未归一化，千问缺字段直接传前端。且 L204 `gradingResult.errors.length` 在后端也会崩（500）。
- **修复（后端）**：`callQwenVL` 返回前统一归一化——`transcription/max_score/total_score/comments` 缺省给空值，`errors/strengths/improvements/points` 缺省为 `[]`，`scores` 归一化为四维默认 0 对象（`g.scores && typeof==='object' ? {content||0,...} : {0,0,0,0}`）。这样前端拿到的 grading 结构永远完整。
- **根因 3（KaTeX 字体缺失）**：`npx expo export --platform web` 只生成了 `katex.min-*.css`，**不拷贝引用的 `fonts/KaTeX_*.woff2`**（CSS url 引用不被 metro 当 asset 依赖）。线上旧提交曾删除这些字体，导致 SVG 渲染异常。
- **修复（字体）**：`cp client/node_modules/katex/dist/fonts/* client/dist/_expo/static/css/fonts/`，再同步到 `server/public/_expo/static/css/fonts/`（共 60 个）。**每次 web 导出后都要补这一步**。
- **关键排查经验**：esbuild/metro 会把中文文案压缩成 `\uXXXX` 转义。grep 产物查"主观题批改"明文找不到不代表产物旧——要 grep `\\u4e3b\\u89c2\\u9898\\u6279\\u6539`（主观题批改）等转义串确认。判断产物是否包含新功能优先对比 entry hash 与 `grep -cP '\\uXXXX'`。
- **部署链路**：线上前端由 `server/public/`（git 跟踪）驱动；`prod_build.sh` 的 `expo export --platform all` 不产 web、不刷新 server/public。**改前端后必须本地 `expo export --platform web` + 补字体 + 同步到 `server/public` + git 提交推送**，Railway 才会用新版。确认本地 `main` 无 `ahead`（`git status -sb`）避免漏推。

## 移动端 fail to fetch（单张偶发、多张必现）/ 上传体积与大请求体
- **根因**：前端 `essay-grading/handleGrade` 直接把**原始照片 base64** 塞进 JSON body（`fetch(uri)` 读原始图）。手机拍的图 base64 单张 10~20MB，最多 3 页可达 30~60MB，逼近后端 `express.json limit 50mb`，移动网络上传统计/连接极易 `fail to fetch`。电脑宽带高、图小，故沙箱与电脑访问都正常，只有手机出问题。
- **修复（前端压缩）**：`handleGrade` 里逐张 `manipulateAsync(uri,[{resize:{width:1000}}],{compress:0.6,format:SaveFormat.JPEG})`（expo-image-manipulator，`npx expo install` 装的 SDK54 兼容版 `~14.0.8`）压缩后再转 base64。单张降到 ~100~300KB，3 张 1MB 内，移动网络稳定。`image-manipulator` 的 `manipulateAsync` 返回 `{uri}`，再 `fetch(uri)`+FileReader 转 dataURL。
- **修复（后端 limit）**：`server/src/index.ts` 把 `express.json({limit:'50mb'})` 与 `urlencoded` 提到 `200mb`，避免极端多张超限。
- **不要开响应 gzip**：AGENTS.md 白屏历史明确——WebView 的 fetch 无法解压响应 gzip；压缩响应会重蹈白屏覆辙。响应端 `marked_images` 已被后端 compressImage(900px/65%) 压过，体积可控。
- **验证**：重导产物后必须在 `server/public` 补 KaTeX 字体（见上一条经验），并 sync 到 server/public + git 提交推送，Railway 才生效。tsc 注意本项目有既有未修复错误 `word-detail(280) fetchMindmapCountsRef.current().catch`，与本次无关（pipeline `lint:all --quiet` 仍能通过）。

## Token Plan（阿里云百炼订阅）Key 接入
- **付费方式**：用户从百炼"免费"换到 **Token Plan 订阅**（`sk-sp-` 开头专属 Key），换取直接调用 `qwen3.8-max` 且免按量费。
- **必须配套专用 Base URL**：Token Plan 的 `sk-sp-` Key **不能配官方向量通用端点**，要配 `https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`。模型 ID 用 `qwen3.8-max`（套餐内）。
- **`.env` 三项**：`QWEN_API_KEY`（sk-sp 专属）、`QWEN_API_URL`（token-plan 端点）、`QWEN_MODEL=qwen3.8-max`。
- **两个 sk-sp Key 的坑**：用户先后给了两个 `sk-sp-H.DEPXLY.*` Key——第一个 `QLB2` 无效（401 invalid_api_key），第二个 `ybkw` 才有效（HTTP 200）。**接 Key 一定要实测**，不要轻信 Key 格式相同。
- **`qwen3.8-max` 默认开启 reasoning**：实测响应含 `reasoning_content` + `reasoning_tokens`，会额外消耗 Credits（reаson输出token + 推理token双计费），比纯文本贵。
- **重要**：`server/.env` 被 gitignore，不随代码上传。**线上 Railway 必须手动在 Variables 里同步 `QWEN_API_KEY`/`QWEN_API_URL`/`QWEN_MODEL` 三个变量**，否则线上仍用旧的免费 Key 走按量计费。
- **服务稳定性**：沙箱会反复 Killed nodemon/多进程抢 5000，导致 service_probe 失败。务必先 `pkill -f "dist/index.js"` + 按 PID 清场，再 `setsid nohup node dist/index.js` 单实例启动，确认 `ss -tlnp|grep 5000` 只有 1 个 pid 再验证。

## qwen3.8-max + response_format:json_object 产生 400 JSON 中断
- **症状**：改历史/复杂输入时 HTTP 500 `{"code":"invalid_parameter_error","message":"Model output became abnormal while generating a JSON response for response_format..."}`。这是**鉴权已通过**（说明 Token Plan Key 配对了），卡在千问 3.8-max 在 `response_format:{type:'json_object'}` 下生成中途输出异常、JSON 不完整被强制中断。
- **修复**：去掉 `callQwenVL` 及各处千问请求体里的 `response_format:{type:'json_object'}`（约 L556）。靠 prompt 强制"只输出合法 JSON" + 后端既有容错（repairJsonTrailing / markdown 包裹提取 / 多候选解析）兜底。实测去掉后 `qwen3.8-max` 返回 HTTP 200 合法 JSON（无中断）。
- **solve-problem（搜题）同样适用**：`server/src/routes/solve-problem.ts` 也不要传 `response_format:{type:'json_object'}`（qwen3.8-max 长题易 400 中断），靠 user prompt 里"JSON 格式硬约束"段落 + 既有 LaTeX/截断自愈容错链兜底。实测移除后简单题 HTTP 200、JSON 正常解析、`$x=5$`。
- **解题答言要正式简洁（solve-problem.ts 输出要求 prompt）**：solution/analysis 必须"正式、简洁、直达结论"——只保留从题干到最终答案的关键推理步骤与必要过渡，明确省略非必要细化推演和冗余代换（例如不必展开"推出 $f(x_2)\ge f(0)$"这类可跳过中间论证、不必对每一步不等式/恒等式/中间式逐条证明），正确作答前提下步骤尽量精炼（5~8 个关键步骤为宜）；语气正式、可直接呈现给学生；确保返回 JSON 完整不截断可解析。
- **解题禁"畏难/元讨论"措辞 + 答案须与题干自带答案一致（solve-problem.ts 答题风格段）**：除自我纠正碎念外，还必须禁止"不好直接求""直接求比较麻烦""考虑到计算较繁"等畏难/方案讨论式铺垫——需要换方法时直接肯定说"采用 XX 方法即可"。新增"答案与题干一致性"约束：若题目图片自带参考答案/小结（如"总结：(1)…；(2)(i)…；(2)(ii)…"），`answer` 字段必须逐项严格一致（同一表达式/形式），analysis/solution 必须推导并收敛到该答案；answer 必须写全每个小题最终结论；analysis（题目分析）与 solution（解答过程）都必须给出实质内容，不得留空或只写标题。起因：用户反馈搜题出现"不好直接求"措辞、答案与题目自带答案栏不一致、解析栏为空。
- **注意**：reasoning 系模型（qwen3.8-max 默认 enable_thinking 即使显式 false）配 `response_format:json_object` 在多图/长上下文中容易触发该 400；普通文本对话也可能偶发。凡调用 qwen3.8-max 且需要 JSON 结构化的场景，倾向用 prompt 强约束而非 response_format。

## 新增功能：录题判分（recording-grading，填空/词块/变形/翻译等逐空卷）

- **定位**：批改页（essay-grading）顶部加"录题"文字按钮 → `router.push('/recording-grading')`。用于批量判分"有多个填空"的卷子（重点单词/词块/变形/句子翻译，中英答案皆可）。
- **前端** `client/screens/recording-grading/index.tsx` + 路由 `client/app/recording-grading.tsx`（已加 `_layout.tsx` Stack.Screen）。
  - 上传最多 6 页卷子图（拍照/相册），上传前 `manipulateAsync` 压到宽 1200、质量 0.7 JPEG（避免 base64 过大）。
  - 设置：答案语言 `en`/`ch`、卷面总分（默认 60）、标准答案（可留空，模型按题干推断）。
  - 请求 `POST /api/v1/essay-grading/recording-grade`，body `{images[], reference_answer, max_score, lang}`，`AbortSignal.timeout(300000)`。
  - 展示：总分、标注图（每页一张，`marked_images[]`）、总体评语、逐空列表（✓/✗ + 学生答案 + 正确写法 + gained/points + 题干）。
- **后端** `server/src/routes/essay-grading.ts`：
  - `router.post('/recording-grade')`：逐页 `compressImage` 得 base64 + `getImageSize` 记录尺寸 → `callRecordingQwenVL`（千问 VL 直接读卷子图）→ 逐页 `annotateRecordingImage` 画 ✓/✗ → 存 `essay_grading_results`（grading_result 存 JSON）。
  - `callRecordingQwenVL(images, referenceAnswer, maxScore, lang)`：prompt 要求识别每个填空（page/part/term/student_answer/reference_answer/is_correct/points/gained/note/bbox[x1,y1,x2,y2]），按题目要求（"每空2分"）或最大分推断每空分值；**不给 response_format**（qwen3.8-max 触发 400），靠 prompt 强约束 + 多候选解析容错；返回前 `normalizeRecording` 归一化。
  - `normalizeRecording`：blanks 逐字段 Number/String/布尔归一化，total_score 缺省回退为 gained 之和。
  - `annotateRecordingImage(base64, blanks)`：blanks 需按 page 过滤后再调用（每页传该页 blanks）。图超 1200x1800 时按 `coordScale` 缩小并同步缩放 bbox。正确画绿✓+`gained/points`，错误画红✗ + 下方红字正确写法；SVG 字体 `DejaVu Sans, WenQuanYi Micro Hei`。
  - **⚠️ 标注定位坐标策略（最新，Otsu+薄带）**：**优先用 Node 端本地印刷横线检测框住"横线/下划线本身"**（用户要求"框住每一条横线"；腾讯/千问只给词框/语义 bbox，不返回横线；`detectBlankLines` 纯像素检测，零三方 API，适配 Railway）。**判别核心（Otsu+薄带）**：① **Otsu 全局阈值**按灰度直方图最大化类间方差求分割阈值（旧"累计 90% 分位"在手机对屏拍的暗背景卷上会把背景误判为墨→横线全丢，务必用 Otsu）；② **薄带行判据**——下划线即使被手写答案/抗锯齿打断成多段，行内墨迹横向整体延伸 `span>=0.35*scanW` 且单行 dark 数 `<0.45*scanW`（细线 vs 文字）；③ 纵向聚合连续候选行(gap≤3)成"细长带"，限带高 `scanH*0.06+8` 且带内行数≤4。真实约束见下一条。
  - **⚠️（重要实测结论）真实录题卷下划线多被手写答案压住，纯像素检测在"已作答+暗背景手机拍卷"上不稳定：短下划线 span 仅 0.2~0.35 达不到阈值会被漏，文字行 dark 密度又易被误收；标定需对真实未批改原卷逐条核对，勿用合成图调参。** 因此对真实卷，**横线检测宜作辅助精调，主力应让千问 VL 给准 bbox**（见 581 行）。
  - `annotateRecordingImage` 匹配：`detectBlankLines` 返回按 y 排序的横线；对每个 blank 用**顺序对齐**（第 i 条未用横线）+ 千问 bbox y 校验（有 bbox 且其 y 中心与横线差距超 `b.yTol` 则跳过该横线用下一条），未命中则降级。**优先级：Node 横线检测 → OCR 词级贴字（locateTextRegion）→ 千问 bbox → 估算排布**。
  - **为何不只用 OCR 贴字**：OCR 定位的是**学生答案字迹**，用户要的是**印刷横线**；答案被手写覆盖时 OCR 定位仍偏。真实带墨卷面横线可能被答案遮断，run 被拆——此场景宁可漏检回退 bbox 也不误框。阈值集中在 `detectBlankLines` 一处便于标定。
  - **⚠️ 错误正确写法长文本换行（已修）**：错误空画 `reference_answer` 时若为长句（如翻译题正确译文），需用 `wrapText` 按 `min(width*0.42, 360*scale)` 折行、最多4行，整体超出底部时上移，避免横向拉成一条长龙贯穿图片。
  - 关键函数/常量：`RECORDING_MAX_PAGES=6`、`RecordingBlank`/`RecordingResult` 接口、`normalizeRecording`、`callRecordingQwenVL`、`annotateRecordingImage`、`getImageSize`（sharp metadata 读数）。
- **注意**：`bbox` 是相对压缩后图片的坐标（千问看到的就是压缩图），标注与放大图同源坐标一致；千问未给 bbox 时估算到左列排布，定位会不准——真实卷建议让千问给准 bbox。**已作答+手机暗拍卷上不要依赖纯像素横线检测，应强化 `callRecordingQwenVL` 的 prompt 让千问为每个空返回精确 2 点像素 box（覆盖横线区域），横线检测仅用于千问无 bbox 或明显偏差时的兜底精调。**
- **⚠️ 标注图在 Web 预览/鸿蒙 WebView 显示空白窄条的根因（已修复）**：录题标注图 `<Image>` 之前用 Tailwind 任意高度类 `h-[520px]`，在 Uniwind Web 下未生成实际高度 → Image 高度塌陷成窄条、看起来"没有标注图"。**必须用 `StyleSheet.create` 数值 `height`（如 `markedImage:{height:520}`）+ `style={styles.markedImage}` + `resizeMode="contain"`**，与作文页 `essay-grading` 完全一致（作文页一直正常）。后端 `annotateRecordingImage` 输出为 `.png()`（JPEG 在部分 WebView 渲染更不可靠）。前端加"卷面标注"标题 + 空时"暂未生成标注图"提示。
  - **⚠️ 标注图显示后无法滚动（已修复）**：录题页布局须与作文页一致——外层 `<View className="flex-1">` 内 `<ScrollView className="flex-1" contentContainerStyle={{padding:16,paddingBottom:40}}>`（**ScrollView 必须加 `flex-1`**，否则 web 端高度坍缩无法下滚）；标注图 `height:340`（勿用 520 占满整屏把下方评语/列表挤出可视区）。录题页可不用 `Screen` 组件（手动 ScrollView 即可），但 flex-1 不能少。

## 词汇量测试 · 五选一改造（120 题客观题）
- **背景**：`gk_vocab` 课标词表原本不带中文释义（meaning 为空）。词汇量测试从"认识/模糊/不认识"主观自评改为**客观五选一**（每题 5 个中文意思，1 正确 + 4 干扰，选对才算对）。
- **释义填充脚本** `server/scripts/build-meanings.mjs`：用千问（沿用 `QWEN_API_KEY`/`QWEN_API_URL`/`QWEN_MODEL`，qwen3.8-max，prompt 强 JSON，**不强加 json_object**）为 `meaning` 为空的词批量生成中文释义写回 `gk_vocab.meaning`。幂等（按 meaning null/空 分页取）、BATCH=100、断点续传、`<batchLimit>` 参数走试跑不写库。注意 `__root = path.resolve(__this,'..')`（server/，不要指向 scripts/）。后台全量跑：`cd server && (nohup node scripts/build-meanings.mjs > /tmp/build-meanings.log 2>&1 &)`，日志 `[批 N] 完成 x/y` 表示推进。
- **后端 `/api/v1/gk-vocab/test`（GET，`limit` 默认 120，clamp [10,200]）**：出题池=**有释义词**，抽样取 1 正确 + 4 随机不同干扰释义，`options` 乱序且**响应不暴露正确项**。返回 `{total(出题池), sampleCount, questions:[{id,word,level,variant,options}]}`。#{total} 会低于全表 3175（只统计已有释义的词）。
- **`/test/submit`（POST `{answers:[{id,chosen}]}`）**：`.in('id',ids)` 批量取正确释义，`chosen===firstMeaning(corr)` 才算对；`estimated = round(correct/sample * 出题池)`。返回 `{correct_count,sample_count,total,estimated_vocab}`。
- **前端 `client/screens/vocab-test/index.tsx`**：五选一答题（读 `/test?limit=120`→逐题展示 `word`+5 个 `options`、可上一题/下一题、未选禁下一题、全部答完才能提交→POST submit→结果页正确数+估算词汇量）。字段是 `questions`（**不是旧版 `words`**）。
- **前端接口验证**：test_run 全绿（lint:all + 探活 + stats + test 五选一 + submit 判分：对2错1→correct_count=2）。新指针的 bundle 存于 `server/public`（Express 静态实时读盘，改前端只需重跑 export+cp，不用重启后端）。

## 搜题/批改：读后续写等"任务完成度硬指标"评分（essay-grading 修复）
- **背景**：用户反馈错误密集、只写一段且字数远不足的读后续写被判 11/25（第四档）"偏高了"。根因：英语作文默认走**通用四维**（内容40/语言30/结构20/书写10），`gradingStandard` 为空时模型把"内容"维度混入任务完成度，甚至评语称"故事情节完整"——**没有"两段/150字/情节完整/与开头衔接"这类续写任务完成度硬判定**，导致低质续写内容维度虚高。
- **修复（前端给标准 + 后端 prompt 强化）**：
  - 前端 `essay-grading/index.tsx`：新增**"英语读后续写"快捷开关**（`switchContinuation`）。打开→`subject='english'`、`maxScore='25'`、`gradingStandard=` 预填 `CONTINUATION_STANDARD`（五档标准，把"任务完成度=两段/约150字/情节完整/衔接开头"列为**第一硬指标**：一段且严重缺字/情节残缺→一档0-4；任务完成度不足但情节成形→二档5-8；基本完成→三档9-12；较好→四档13-16；优秀→五档，满分区间按25缩放）。关闭→回满分15+清空标准。切换科目会重置续写开关。
  - 后端 `essay-grading.ts`（subject 分支/评分 prompt）：当 `gradingStandard` 非空并含任务完成度要求时，模型须把"段落数/字数/情节完整/与开头衔接"作为**硬降档依据**（只写一段+字数不足→content/structure 几乎扣光，落最低档）。
- **验证**：同一张续写图，标准为空时 11/25（第四档）；带续写标准后 7/25（最低档，content=3/structure=1），评语改为"任务完成度严重缺失、字数仅约70词远低于150、烂尾"。**结论**：读后续写必须引导用户开此开关（或填含任务完成度的评分标准），否则按通用作文四维会判高。
- **经验**：any 判分给分过高，往往是评分 prompt 的维度里漏了"任务完成度"这类**硬性不达标扣分项**，通通用"合理想象/顺畅/完成"语调兜底。对续写/写作类应把"结构要素是否齐全 + 字数/段落"提升为与语言并列的独立硬指标。

#### 读后续写评分已重写为「情节/衔接主轴判档」六档（2026-09 依据 12 份人工批改原卷校准，替代旧"从高到低逐档比对"）
- **核心原则（用户拍板）**：**情节/衔接质量是第一权重**，贯穿所有档位；词数/错误/词汇**只作档内二次微调**；**字数必须与原文情节高度相关**（先决条件）。判档主依据是续写情节的完整度与衔接质量，**不是**词数或错误数量。
- **判档流程**：先做先决校验（是否承接推进原文故事线；完全离题/无自主内容→0分）→ 按情节完整度分级（L0-L5）定主航向 → 进对应档区 → 同档内用词数/错误/词汇微调定档内分。**禁止**仅凭词数/错误数量定档，也禁止仅凭词汇堆砌升档。
- **情节完整度分级（第一权重）**：
  - L5 情节完整且收束有力（冲突→推进→解决→情感升华/感悟/呼应原文）+ 多样化高中词或语法 → 四档上沿及五档（16-25）
  - L4 情节完整、结局明确、有情感升华/顿悟/成长感悟（结尾点出道理、情感收束、或呼应原文意象）→ 三档上沿到四档（14-20）
  - L3 情节完整（冲突→有明确结局/和解）、逻辑自洽、衔接基本顺畅 → 三档（11-15）
  - L2 情节不完整（未写结局但已完整展开一个冲突场景、有推进行为）→ 三档下沿到二档（6-12）
  - L1 情节碎片（仅零散场景/几句话带过、无完整冲突、无推进无结局）→ 一档（1-5）
  - L0 离题/无自主内容 → 0 分
- **档位区间（满分25，0.5为步长）**：
  - 五档 21-25：L5，衔接非常顺畅+逻辑严密（因果/让步等），多样化高中词+语法，错误极少。
  - 四档 16-20：L4，衔接自然顺畅，词汇多样有高中词、语法较多样，错误不多（可参考≤10处）。
  - 三档 11-15：L3，衔接基本顺畅，词汇语法较基础、高中词少，错误较多（可参考10-15处）。
  - 二档 6-10：L2，衔接一般，错误很多。
  - 一档 1-5：L1，衔接生硬，错误极多。
  - 0分：离题/无自主内容。
- **边界确认（2026-09 校准，用户拍板）**：① **二段没写≠一定一档**——若第一段完整展开了一个冲突场景、语言尚可（能力强者时不够未完卷），最高可升**二档**（通常6-8）；若第一段仍属情节碎片则一律一档。② 档内 0.5 步长同档内按"词数足/错误少/高中词多→上沿，词短/错多→下沿"微调。③ 词数不达标/严重偏短一般难进四档以上。
- **代码落点**：前端 `CONTINUATION_STANDARD` 常量（`client/screens/essay-grading/index.tsx` 顶部，随"英语读后续写"开关 switchContinuation 自动预填，满分自动 25）；后端 `essay-grading.ts` 里 `continuation` 分支的 CONT prompt（`gradingStandard` 非空即按档位锁 total_score，同文件 L1/L2 分界、二档升档前提、L4 升华信号三处已强化）。前端识别续写用 `isContinuationMode = isContinuation || /读后续写|续写|两步法|档位|五档/.test(gradingStandard)`，与后端自动识别（`/读后续写|续写|两步法|档位|1档|一档/`）保持一致。
- **校准实测（12 份原卷回测，人工分 vs 模型）**：3.jpg(二段空、90词、情节碎片)→ 人工 3 / 模型 2（一档）✅；15.jpg(二段完整、210词、情节完整+情感升华)→ 人工 15 / 模型 12（三档）✅。**注意**：模型对同一篇存在偶发抖动（15.jpg 偶发判到二档7），为模型固有波动非规则错误，temperature 已压 0.2。
- **【13分起评硬规定（用户2026-09指定，已加强到语言不降级后仍锁13）】**：读后续写只要**两段都完整展开、且情节主线合理自洽**（冲突→推进→结局/和解顺序成立、非敷衍空洞两段），总分**从 13 起评**（三档中上），**语言/错误/词数只能在 13 之上做档内微调，不得低于 13**；**语言差（错误密集/拼写词性误用/中式表达/影响阅读流畅度）绝不构成降到 11-12 的理由**，仅**情节本身**有硬伤（逻辑断裂/严重偏离段首句/戛然而止/两段空洞敷衍）才落 11-12。已写入：前端 CONTINUATION_STANDARD 的 L3 与铁律#1、后端 CONT prompt 的 L3 硬规定与铁律#1、以及后端 13分起评程序化兜底（评语含"两段完整/完整续写"+“情节合理/自洽”且无硬伤标志、total_score<13 时强制抬到 13）。
- **【语言绝不跨档铁律（2026-09 真实卷实测后加，重要）】**：真实测卷发现模型在"情节完整（自己评语都承认起承转合/升华都在）但语言错误极密"时会**私自把三/四档踩成一档**（image_...59.png 人工≈14，系统曾判 2 分一档），违反"情节第一权重、语言仅档内微调"。根因与 OCR 无关（原图以 image_url 已喂给千问 VL，模型能看图），是模型被"错误极多"吓到跨档压分 + temperature 0.3 随机。**修复（`essay-grading.ts` CONT prompt）**：新增"语言绝不跨档"铁律——只要两段完整展开、有结局/升华，即使错误极多也**至少三档(11-15)下沿到二档**，严禁一档；评语与档位矛盾视为判错。同时 temperature 0.3→**0.2**。**修复后复测同一篇：2→12（三档）✅**，与人工同档。**教训**：这是问题17"少即多"在续写判档上的反面——判档必须强制隔离语言对档位的影响，语言只能动档内分，否则"情节完整"会被淹没在拼写错误里。
- **【"错误绝不降档"升级为铁律 #1（用户重点强调，2026-09）】** 用户明确"不要因为错误强制降档，要特别注意"。已把该条写成 CONT prompt 的【铁律 #1】放最前、前端 CONTINUATION_STANDARD 同步，措辞强调：错误**数量与严重程度**均不得作降档依据，只能档内微调；只要完整推进故事并给出结局就**至少三档下沿到二档、严禁一档**；评语用词与档位矛盾（如承认情节完整却判二档以下）视为判错。改后端须 `node build.js`+pkill 重启。
- **【"情节完整+有结局/升华→锁三档及以上，不落二档"（用户再次收紧，2026-09）】** 用户补充：情节完整且给出结局/升华的作文，即使错误极密也**只能压到三档下沿取 11-12，绝不能降到二档**；语言只能把"情节完整"的在三档以上微调，永不压到三档以下。二档仅保留给"情节不完整(缺结局, L2)"或"二段未写但第一段完整、语言尚可"。前后端铁律 #1 均已同步此表述，AGENTS.md 以本条为准。
- **【二段未写升二档的语言硬门槛（用户再收紧，2026-09）】** 用户补充并强调：像"错误过多"这类二段未写但第一段完整的卷子，**应给 5 分上下（一档上沿，约4-6），不能靠情节撑到二档**；只有**错误很少（约1-4个）且无句法/句式问题**（句子残缺/语序混乱/杂糅等句法级问题即不过关）才算"第一段写得好"，才能升二档（通常6-8）。已同步后端三处（二档定义、硬性规则2、提示句铁律）+ 铁律#1分支 + 前端对应四处。**核心：二段未写时"第一段写得好"=情节完整+语言洁净双门槛，语言是硬门槛**。
- **【评语↔分数档内位置矛盾（用户实测抓到，已修，2026-09）】** 用户抓到一个 bug：某二段未写卷评语写了"压到一档上沿附近（约5分，4-6）"但实际 total_score 只给 2 分（一档下沿）——模型"评语复述规则位置"与"实际打的分"互相矛盾，后端原样采信 total_score 未校验。**修复**：① prompt 新增【铁律#2】强制"先定分数再写评语、分数与理由位置严格一致"（说一档上沿→4-6，一档下沿→1-3，二档下沿→6-8，三档下沿→11-13，不一致优先改分数贴合评语）；② 后端 continuation 分支加程序化强一致校验：评语含"一档上沿/约5分/4-6"但分数<4 → 抬到 4-6；评语含"一档下沿/1-3"但分数>3 → 压回 1-3。评语/档位/分数三角强一致，任何对不上都判错。**注意判定陷阱（重要）**：程序化校验判断"是否一档"绝不能依赖"评语里没有'二档'字样"——读后续写评语经常引用规则说明（如"二段未写最高只能进入二档(6-10分)"），会误伤 `isFirstTier` 导致整段钳分被跳过（用户实测：评语明明写了"压到一档上沿附近(4-6)"却仍留 2 分）。**正确做法**：直接用模型返回的 `tier.min/max`（=1-5 即一档）判定档位，再看评语位置关键词钳分；tierInfo 缺失时才回退评语正则。改后端须 `node build.js`+pkill 重启，改前端须重新 expo export。
- **【档内书写整洁奖励 +1~1.5（用户2026-09指定，判据已明确防误判）】** 同一档内其他条件相近时，卷面书写整洁清晰、字迹工整易读 → 档内上浮 1~1.5 分（不跨档）；书写潦草/难以辨认则不上浮、偏向中下。**整洁物理判据**：字迹工整规范易读、卷面清爽、绝大多数字可辨认。**常见忽略项（不构成"潦草/卷面一般"）**：个别连笔稍随意、个别划改/涂改（只要不影响辨认）、少量涂改痕迹、个别重写拼写。仅**整体字迹潦草难辨、多处乱涂、大面积难辨认**才判"潦草/卷面一般"取消奖励。**判据已把"整洁/潦草"定义写死进前端第4条与后端 CONT 第4条，并要求结合原文图片判断真实卷面、不可只凭转录文本猜**——否则模型会把"有涂改"草判成"潦草"（实测 image_...14738083 卷面字迹工整仅 4 处涂改，模型误评"书写较为潦草"）。**另加程序化兜底（后端）**：评语明确含整洁信号（书写整洁/工整/清晰/规整/尚可、卷面整洁/干净/清爽/工整/尚可、字迹工整/清晰/规范等）且不含潦草信号时，若总分未体现上浮则自动档内 +1.5（封顶档内 max，绝不跨档）；评语含"书写潦草/卷面乱/字迹难辨"则跳过大奖。实测三档13分+书写工整→14.5。**兜底正则陷阱（重要）**：整洁匹配最初要求"书写/卷面/字迹"后紧跟整洁词，遇到"书写**较为**整洁清晰"（中间隔副词"较为"）会匹配失败→总分未上浮（实测评语写"13上浮至14"但总分仍13）。已放宽为 `(?:书写|卷面|字迹)[\s\S]{0,6}(?:整洁|工整|清晰|…)` 承载副词；并优先遵循评语明确承诺的数字——评语"上浮至/定为/最终为 X 分"且 X 落在档内、高于现分时直接采用 X（如"上浮至14"→14），否则回退 +1.5，彻底消除"评语说14却给13"。
- **已知校准样本库**：`assets/3.jpg`(3)、`4.5.jpg`、`9.jpg`、`10.jpg`、`11.jpg`、`11.5.jpg`(硬改15)、`12.jpg`、`12.5.jpg`、`14.jpg`、`15.jpg`、`16.5.jpg`、`111111*.jpg`(题目原文)。人工分：3/4.5/9/10/11/15/12/12.5/14/15/16.5；原文段首两行见 `111111*`。改前端后须 `expo export --platform web`+复制到 `server/public` 才生效；改后端须 `node build.js`+pkill 重启。
