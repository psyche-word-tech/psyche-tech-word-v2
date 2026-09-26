import dotenv from 'dotenv';
import path from "path";
import express, { type Response } from "express";
import cors from "cors";
import fs from "fs";
import { fileURLToPath } from "url";
import { checkDatabaseHealth, startKeepAlive, resetSupabaseClient } from "./storage/database/supabase-client";
import dns from "node:dns/promises";
import net from "node:net";
import https from "node:https";
import wordsRouter from "./routes/words";
import userWordsRouter from "./routes/user-words";
import wordbooksRouter from "./routes/wordbooks";
import authRouter from "./routes/auth";
import commentsRouter from "./routes/comments";
import exampleImagesRouter from "./routes/example-images";
import grammarCheckRouter from "./routes/grammar-check";
import speechEvalRouter from "./routes/speech-eval";
import ttsRouter from "./routes/tts";
import mindmapRouter from "./routes/mindmap";
import solveProblemRouter from "./routes/solve-problem";
import favoritesRouter from "./routes/favorites";
import submissionsRouter from "./routes/submissions";
import irisRouter from "./routes/iris";
import accountRouter from "./routes/account";
import settingsRouter from "./routes/settings";
import essayGradingRouter from "./routes/essay-grading";
import gkVocabRouter from "./routes/gk-vocab";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const port = Number(process.env.PORT) || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));

// 在 static 中间件之前统一走 serveIndexHtml，保证根路径也注入 interactive-widget
// （否则 express.static 会直接返回原始 index.html，跳过注入）
app.use((req, res, next) => {
  if (req.method === 'GET' && (req.path === '/' || req.path === '/index.html')) {
    return serveIndexHtml(res);
  }
  next();
});

// Serve frontend static files
// 禁用缓存：WebView/浏览器可能复用旧 bundle，导致部署成功后仍看不到更新
app.use(
  express.static(path.join(__dirname, '../public'), {
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-store');
    },
  })
);

/**
 * 解决手机浏览器（鸿蒙/小米异常、iQOO 老版正常）注册页密码框"软键盘闪退"无法输入。
 *
 * 根因：新版手机浏览器默认 interactive-widget=resizes-visual——软键盘悬浮弹出、布局视口保持原高，
 * 而 RN Web reset（html/body/#root{height:100%} + body{overflow:hidden}）把整页钉死在视口高、内容永不溢出、
 * 无任何可滚动区域；密码框被键盘物理盖住又无法滚到可见，系统判定 input 不可见而收键盘。
 * iQOO 老版自动 resizes-content（键盘弹出时布局视口收缩、RN ScrollView 随之变小、内容溢出可滚）故正常。
 *
 * 双保险修复：
 *  1) viewport meta 加 interactive-widget=resizes-content（声明式，支持它的浏览器直接对齐老版行为）；
 *  2) 注入 JS：即便浏览器不认该 meta，也监听软键盘（visualViewport/onresize/focusin）把 #root 压到可视视口高度，
 *     RN 内层 ScrollView 高度随之变小、内容溢出获得滚动能力，再主动把聚焦 input 滚到可见。
 *     （实测：#root 从 844 压到 460 后 ScrollView sh696>h460 可滚、密码框经 scrollIntoView 落于可视区。）
 */
const INTERACTIVE_WIDGET_META =
  'name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, interactive-widget=resizes-content"';
// 注入到 </head> 前，仅移动端启用
const KEYBOARD_FIX_SCRIPT = `<script>
(function(){
  if (typeof window === 'undefined') return;
  var isMobile = (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
    (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width:768px)').matches);
  if (!isMobile) return;

  // ===== diagnostic overlay: APPEND keyboard-state events to a persistent, top-anchored log =====
  // Top-anchored so the soft keyboard never covers it; log keeps every event so even if the
  // keyboard flashes away and back, the user can scroll the log afterwards to read what happened.
  var diagEl = null;
  var diagLog = [];
  function ensureDiag() {
    if (diagEl) return diagEl;
    diagEl = document.createElement('pre');
    diagEl.id = 'kbDiag';
    diagEl.style.cssText = 'position:fixed;top:6px;left:6px;right:6px;z-index:2147483647;' +
      'background:rgba(0,0,0,0.9);color:#7CFC00;font:9px/1.4 ui-monospace,Monaco,monospace;' +
      'padding:4px 6px;border-radius:6px;max-height:52%;overflow:auto;' +
      'white-space:pre-wrap;word-break:break-all;text-align:left;box-shadow:0 0 0 1px rgba(255,255,255,0.4);';
    diagEl.textContent = '[keyboard-diag] focus an input, then tap here to scroll the log';
    diagEl.addEventListener('click', function(){
      diagEl.classList.toggle('kb-open');
      renderDiag();
    });
    document.documentElement.appendChild(diagEl);
    return diagEl;
  }
  function renderDiag() {
    if (!diagEl) return;
    if (diagEl.classList.contains('kb-open')) {
      diagEl.textContent = diagLog.join(String.fromCharCode(10));
    } else {
      var show = null;
      for (var i = diagLog.length - 1; i >= 0; i--) {
        if (diagLog[i].indexOf('rectTop=') !== -1) { show = diagLog[i]; break; }
      }
      if (show === null) {
        for (var j = diagLog.length - 1; j >= 0; j--) {
          if (diagLog[j].indexOf('[focus:') === 0 || diagLog[j].indexOf('[reveal:') === 0) { show = diagLog[j]; break; }
        }
      }
      if (show === null) show = diagLog[diagLog.length - 1] || '';
      diagEl.textContent = show.length > 200 ? show.slice(0, 197) + '...' : show;
    }
  }
  function pushDiag(tag, data) {
    try {
      ensureDiag();
      var lines = ['[' + tag + ']'];
      for (var k in data) {
        if (Object.prototype.hasOwnProperty.call(data, k) && data[k] !== undefined && data[k] !== null) {
          lines.push(k + '=' + data[k]);
        }
      }
      diagLog.push(lines.join(String.fromCharCode(10)));
      if (diagLog.length > 24) diagLog.shift();
      renderDiag();
    } catch (e) {}
  }
  function measure(el) {
    var vv = window.visualViewport;
    var visibleH = vv && vv.height ? vv.height : window.innerHeight;
    if (!el) return { type: 'none', visibleH: Math.round(visibleH), vvH: vv ? Math.round(vv.height) : null, innerH: window.innerHeight };
    try {
      var rect = el.getBoundingClientRect();
      var need = (rect.bottom > visibleH - 8 || rect.top < 0);
      return { type: el.type || 'text', ph: el.placeholder || el.name || el.tagName, rectTop: Math.round(rect.top), rectBottom: Math.round(rect.bottom), visibleH: Math.round(visibleH), vvH: vv ? Math.round(vv.height) : null, innerH: window.innerHeight, need: need };
    } catch (e) {
      return { err: String(e) };
    }
  }
  // keyboard pops up => visualViewport shrinks; squash #root so RN ScrollView overflows & scrolls
  function squash() {
    var root = document.getElementById('root');
    if (!root) return { target: null, appliedHeight: null, rootClient: null };
    var vv = window.visualViewport;
    var visH = vv && vv.height ? vv.height : window.innerHeight;
    var target = null;
    // 键盘压缩了可视区(visH变小)但 #root 没跟随缩小(clientHeight>visH)时，
    // 必须强制把 root 压到可视高，使 RN ScrollView 获得溢出滚动能力(否则内容锁定不可滚)
    if (typeof visH === 'number' && root.clientHeight > visH) target = visH;
    else if (vv && vv.height && vv.height < window.innerHeight) target = vv.height;
    if (target && root.style.height !== target + 'px') root.style.height = target + 'px';
    return { target: target, appliedHeight: root.style.height, rootClient: root.clientHeight };
  }
  // scroll focused input into view only if it is actually covered by the keyboard
  function reveal() {
    var el = document.activeElement;
    if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT')) return null;
    var vv = window.visualViewport;
    var visibleH = vv && vv.height ? vv.height : window.innerHeight;
    var rect = el.getBoundingClientRect();
    var need = (rect.bottom > visibleH - 8 || rect.top < 0);
    if (need) {
      el.scrollIntoView({ block: 'center', behavior: 'auto' });
    }
    return measure(el);
  }
  function onFocus() {
    var el = document.activeElement;
    var label = (el && (el.placeholder || el.name || el.type || el.tagName)) || '?';
    try {
      var s = squash();
      var m = measure(el);
      pushDiag('focus:' + label, Object.assign({ rootTarget: s && s.target, rootH: s && s.appliedHeight, rootC: s && s.rootClient }, m || {}));
      setTimeout(function(){
        try {
          var s2 = squash();
          var r = reveal();
          var rootC2 = document.getElementById('root');
          pushDiag('reveal:' + label, Object.assign({ rootTarget: s2 && s2.target, rootH: s2 && s2.appliedHeight, rootC: rootC2 ? rootC2.clientHeight : null }, r || {}));
        } catch (e) { pushDiag('reveal:' + label, { err: String(e) }); }
      }, 60);
    } catch (e) { pushDiag('focus:' + label, { err: String(e) }); }
  }
  document.addEventListener('focusin', onFocus, true);
  function onResize() {
    if (typeof window === 'undefined') return;
    var root = document.getElementById('root');
    var vv = window.visualViewport;
    pushDiag('resize', { vvH: vv ? Math.round(vv.height) : null, innerH: window.innerHeight, rootH: root ? root.style.height : null, rootC: root ? root.clientHeight : null });
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function(){ squash(); reveal(); onResize(); });
  } else {
    window.addEventListener('resize', function(){ squash(); reveal(); onResize(); });
  }
})();
</script>`;
let indexHtmlCache: string = '';
function serveIndexHtml(res: Response) {
  const indexPath = path.join(__dirname, '../public/index.html');
  if (!fs.existsSync(indexPath)) {
    res.status(200).json({ status: 'ok', service: 'word-voyage-api' });
    return;
  }
  if (!indexHtmlCache) {
    let html = fs.readFileSync(indexPath, 'utf-8');
    if (html.includes('interactive-widget') === false) {
      html = html.replace(
        '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />',
        `<meta ${INTERACTIVE_WIDGET_META} />`
      );
    }
    if (html.includes('KEYBOARD_FIX') === false && html.includes('focusin') === false) {
      html = html.replace('</head>', `${KEYBOARD_FIX_SCRIPT}</head>`);
    }
    indexHtmlCache = html;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.type('html').send(indexHtmlCache);
}

// Serve face-api.js models from server/models/ (not public/models/)
// This ensures models are never deleted when public/ is rebuilt
app.use('/models', express.static(path.join(__dirname, '../models')));

/**
 * 根路径 - 优先 serve 前端 index.html，不存在时返回 API 状态
 */
app.get('/', (req, res) => {
  serveIndexHtml(res);
});

/**
 * 健康检查接口 - 验证数据库连接
 * Railway 使用此接口判断服务是否健康
 */
app.get('/api/v1/health', async (req, res) => {
  const result = await checkDatabaseHealth();
  if (result.healthy) {
    res.status(200).json({ status: 'ok', db: 'connected' });
  } else {
    console.error('Health check failed:', result.error);
    res.status(503).json({ status: 'error', db: 'disconnected', error: result.error });
  }
});

/**
 * 重置数据库连接接口（用于手动恢复）
 */
app.post('/api/v1/health/reset', (req, res) => {
  resetSupabaseClient();
  res.status(200).json({ status: 'ok', message: 'Database connection reset' });
});

/**
 * 环境体检接口 - 仅报告关键环境变量是否存在（不打印值）
 * 用于定位 Railway 上 PADDLEOCR_ACCESS_TOKEN 等变量是否被注入
 */
app.get('/api/v1/env-check', (req, res) => {
  const keys = [
    'PADDLEOCR_ACCESS_TOKEN',
    'TENCENT_SECRET_ID',
    'TENCENT_SECRET_KEY',
    'QWEN_API_KEY',
    'QWEN_API_URL',
    'QWEN_MODEL',
    'COZE_SUPABASE_URL',
    'COZE_SUPABASE_SERVICE_ROLE_KEY',
  ];
  const result: Record<string, boolean> = {};
  for (const k of keys) {
    result[k] = !!(process.env[k] && String(process.env[k]).trim());
  }
  res.json({ env: result });
});

/**
 * OCR 网络诊断接口 - 检测部署环境到腾讯云 OCR 的连通性
 * 用于定位 Railway 上 "Connection failed: fetch failed" 的根因
 * 依次测试 DNS 解析、TCP 连接、HTTPS 完整往返
 */
app.get('/api/v1/ocr-diagnose', async (req, res) => {
  const HOST = process.env.TENCENT_OCR_HOST || 'ocr.tencentcloudapi.com';
  const out: Record<string, unknown> = {
    host: HOST,
    env: {
      TENCENT_SECRET_ID: !!(process.env.TENCENT_SECRET_ID && process.env.TENCENT_SECRET_ID.trim()),
      TENCENT_SECRET_KEY: !!(process.env.TENCENT_SECRET_KEY && process.env.TENCENT_SECRET_KEY.trim()),
      TENCENT_OCR_REGION: process.env.TENCENT_OCR_REGION || 'ap-guangzhou',
    },
  };

  // 1. DNS 解析
  try {
    const t0 = Date.now();
    const addrs = await dns.lookup(HOST, { all: true });
    out.dns = { ok: true, ms: Date.now() - t0, addresses: addrs.map((a) => a.address) };
  } catch (e) {
    out.dns = { ok: false, error: (e as Error).message };
    return res.json(out);
  }

  // 2. TCP 连接
  try {
    const t0 = Date.now();
    await new Promise<void>((resolve, reject) => {
      const sock = net.connect({ host: HOST, port: 443, timeout: 8000 });
      sock.once('connect', () => { sock.destroy(); resolve(); });
      sock.once('error', reject);
      sock.once('timeout', () => { sock.destroy(); reject(new Error('TCP connect timeout')); });
    });
    out.tcpConnect = { ok: true, ms: Date.now() - t0 };
  } catch (e) {
    out.tcpConnect = { ok: false, error: (e as Error).message };
    return res.json(out);
  }

  // 3. HTTPS 完整往返（GET，仅测连通性）
  try {
    const t0 = Date.now();
    await new Promise<void>((resolve, reject) => {
      const req = https.request({ host: HOST, path: '/', port: 443, method: 'GET', timeout: 10000 }, (r) => {
        r.resume();
        r.once('end', () => resolve());
        r.once('error', reject);
      });
      req.once('timeout', () => { req.destroy(new Error('HTTPS request timeout')); });
      req.once('error', reject);
      req.end();
    });
    out.https = { ok: true, ms: Date.now() - t0 };
  } catch (e) {
    out.https = { ok: false, error: (e as Error).message };
    return res.json(out);
  }

  out.conclusion = '网络连通正常：DNS`+TCP+HTTPS 全部通过';
  res.json(out);
});

/**
 * 临时接口：创建 abcd 表并复制 words_a 数据
 */
app.post('/api/v1/admin/create-abcd', async (req, res) => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.COZE_SUPABASE_URL || '',
      process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // 1. 创建 abcd 表
    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS abcd (
          id SERIAL PRIMARY KEY,
          word TEXT,
          phonetic TEXT,
          meaning TEXT,
          example TEXT,
          translation TEXT,
          example_translation TEXT,
          example_image_url TEXT,
          example_audio_url TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `
    });

    if (createError) {
      console.log('Create table error (may already exist):', createError.message);
    }

    // 2. 清空 abcd 表
    await supabase.from('abcd').delete().neq('id', 0);

    // 3. 从 words_a 复制数据
    const { data: wordsA, error: fetchError } = await supabase.from('words_a').select('*');
    if (fetchError) throw fetchError;

    if (wordsA && wordsA.length > 0) {
      const { error: insertError } = await supabase.from('abcd').insert(wordsA);
      if (insertError) throw insertError;
    }

    // 4. 验证
    const { data: abcdData, error: verifyError } = await supabase.from('abcd').select('*');
    if (verifyError) throw verifyError;

    res.json({
      status: 'ok',
      message: 'abcd table created and data copied from words_a',
      words_a_count: wordsA?.length || 0,
      abcd_count: abcdData?.length || 0
    });
  } catch (error: any) {
    console.error('Create abcd error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 返回 API 配置信息给前端
app.get('/api/v1/config', (req, res) => {
  const baseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 
                  `${req.protocol}://${req.get('host')}`;
  res.json({ 
    apiBaseUrl: baseUrl,
    version: '1.0.0'
  });
});

// Routes
app.use('/api/v1/words', wordsRouter);
app.use('/api/v1/user-words', userWordsRouter);
app.use('/api/v1/wordbooks', wordbooksRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/comments', commentsRouter);
app.use('/api/v1/example-images', exampleImagesRouter);
app.use('/api/v1/grammar-check', grammarCheckRouter);
app.use('/api/v1/speech-eval', speechEvalRouter);
app.use('/api/v1/tts', ttsRouter);
app.use('/api/v1/mindmap', mindmapRouter);
app.use('/api/v1/solve-problem', solveProblemRouter);
app.use('/api/v1/favorites', favoritesRouter);
app.use('/api/v1/submissions', submissionsRouter);
app.use('/api/v1/iris', irisRouter);
app.use('/api/v1/user', accountRouter);
app.use('/api/v1/settings', settingsRouter);
app.use('/api/v1/essay-grading', essayGradingRouter);
app.use('/api/v1/gk-vocab', gkVocabRouter);
app.use('/api/submissions', submissionsRouter);
app.use('/api/iris', irisRouter);

// SPA fallback: serve index.html for non-API routes (exclude /models/)
app.get('*', (req, res) => {
  // Don't intercept /models/ requests - let static middleware handle them
  if (req.path.startsWith('/models/')) {
    return res.status(404).send('Not found');
  }
  serveIndexHtml(res);
});

// 全局未捕获异常处理 - 防止进程崩溃退出
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
  // 记录错误但不退出进程，保持服务可用
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
  // 记录错误但不退出进程
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server listening at http://localhost:${port}/`);
  // 启动数据库连接保活（每60秒检查一次）
  startKeepAlive(60000);
  console.log('Database keep-alive started');
});
