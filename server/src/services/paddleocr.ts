import { PaddleOCRClient, Model } from '@paddleocr/api-sdk';
import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { basename, dirname, join } from 'path';
import { fileURLToPath } from 'url';

let client: PaddleOCRClient | null = null;

function getClient(): PaddleOCRClient {
  if (!client) {
    const token = process.env.PADDLEOCR_ACCESS_TOKEN || '5332cbc5f8c27b2ee620aad7be63b2414c3e4003';
    if (!token) {
      throw new Error('PADDLEOCR_ACCESS_TOKEN 未配置');
    }
    client = new PaddleOCRClient({
      token,
      requestTimeout: 60_000,
      pollTimeout: 120_000,
    });
  }
  return client;
}

export interface WordBox {
  text: string;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

// 词框(行框)纵向 padding 收缩比例：PP-OCRv5 行框上下常带多余空白，
// 以顶边为锚把高度收窄到字迹区，使"词框最低点"贴近真实字迹底。
const BOX_VERTICAL_SHRINK = 0.9;

// 对检测盒做垂直收缩并水平居中：返回 { y, height }（顶部对齐会让框底悬空/下探字母被切，居中更贴字迹）
function shrinkV(y1: number, y2: number): { y: number; height: number } {
  const h = Math.round((y2 - y1) * BOX_VERTICAL_SHRINK);
  const offset = Math.round((y2 - y1 - h) / 2);
  return { y: Math.round(y1) + offset, height: h };
}

// 本地 PaddleOCR 环境（server/ocr-service 下的虚拟环境 + 脚本）
function localOcrPaths(): { py: string; script: string } | null {
  // esbuild 产物为 ESM（format: esm），__dirname 不可用，改用 import.meta.url
  // 运行时代码在 server/dist 下，其上一级即 server/ocr-service
  const serverRoot = dirname(fileURLToPath(import.meta.url)); // .../server/dist
  const ocrDir = join(serverRoot, '..', 'ocr-service');
  const py = join(ocrDir, '.venv', 'bin', 'python');
  const script = join(ocrDir, 'ocr_local.py');
  if (!existsSync(py) || !existsSync(script)) return null;
  return { py, script };
}

interface LocalRec {
  text: string;
  score: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  box?: number[][]; // [[x,y],[x,y],[x,y],[x,y]] 四点（旧脚本）
}

// 把本地输出转成 WordBox：新脚本已给出贴字词级框（x/y/w/h），直接采用；
// 旧脚本（无 x/y/w/h 字段）回退到"按空格 token 比例硬拆 + 垂直收缩"
function splitLocalWords(recs: LocalRec[], meta?: any): WordBox[] {
  const words: WordBox[] = [];
  for (const line of recs) {
    // 新脚本字段：直接使用紧贴字迹的框
    if (typeof line.x === 'number' && typeof line.width === 'number') {
      words.push({
        text: line.text || '',
        bbox: [Math.round(line.x), Math.round(line.y!), Math.round(line.x + line.width), Math.round(line.y! + line.height!)],
        x: Math.round(line.x),
        y: Math.round(line.y!),
        width: Math.round(line.width),
        height: Math.round(line.height!),
        confidence: line.score,
      });
      continue;
    }
    // 旧脚本：多边形 + 比例硬拆
    const poly = line.box;
    if (!poly || poly.length < 4) continue;
    const x1 = Math.min(poly[0][0], poly[3][0]);
    const x2 = Math.max(poly[1][0], poly[2][0]);
    const y1 = Math.min(poly[0][1], poly[1][1]);
    const y2 = Math.max(poly[3][1], poly[2][1]);
    const width = x2 - x1;
    const { y: topY, height: h } = shrinkV(y1, y2);
    const bottom = topY + h;

    const tokens = (line.text || '').split(/\s+/).filter(Boolean);
    if (tokens.length <= 1) {
      words.push({
        text: (line.text || '').trim(),
        bbox: [Math.round(x1), topY, Math.round(x2), bottom],
        x: Math.round(x1),
        y: topY,
        width: Math.round(x2 - x1),
        height: h,
        confidence: line.score,
      });
      continue;
    }
    const totalChars = tokens.reduce((s, w) => s + w.length, 0);
    if (totalChars <= 0) continue;
    let cursor = x1;
    for (const token of tokens) {
      const wordRight = cursor + (width * token.length) / totalChars;
      words.push({
        text: token,
        bbox: [Math.round(cursor), topY, Math.round(wordRight), bottom],
        x: Math.round(cursor),
        y: topY,
        width: Math.round(wordRight - cursor),
        height: h,
        confidence: line.score,
      });
      cursor = wordRight;
    }
  }
  return words;
}

// 调用本地 PaddleOCR venv 脚本，返回词级框
function runLocalOCR(filePath: string): Promise<{
  success: boolean;
  words: WordBox[];
  error?: string;
}> {
  return new Promise((resolve) => {
    const paths = localOcrPaths();
    if (!paths) {
      resolve({ success: false, words: [], error: '本地 OCR 环境未就绪' });
      return;
    }
    execFile(
      paths.py,
      [paths.script, filePath],
      { timeout: 120_000, maxBuffer: 64 * 1024 * 1024 },
      (err, stdout) => {
        if (err) {
          resolve({ success: false, words: [], error: `本地 OCR 执行失败: ${err.message}` });
          return;
        }
        try {
          const lines = stdout.split('\n').filter(Boolean);
          if (!lines.length) {
            resolve({ success: false, words: [], error: '本地 OCR 输出为空' });
            return;
          }
          const meta = JSON.parse(lines[0]);
          if (!meta.ok) {
            resolve({ success: false, words: [], error: meta.error || '本地 OCR 失败' });
            return;
          }
          const recs: LocalRec[] = [];
          for (let i = 1; i < lines.length; i++) {
            try {
              recs.push(JSON.parse(lines[i]));
            } catch {
              /* skip bad line */
            }
          }
          const words = splitLocalWords(recs, meta);
          resolve({ success: words.length > 0, words, error: words.length ? undefined : '无识别结果' });
        } catch (e: any) {
          resolve({ success: false, words: [], error: `本地 OCR 解析失败: ${e.message}` });
        }
      }
    );
  });
}

/**
 * 调用 PaddleOCR 获取词级坐标
 */
export async function callPaddleOCR(imageBase64: string, lang: string = 'en'): Promise<{
  success: boolean;
  words: WordBox[];
  error?: string;
}> {
  try {
    // 处理 base64 前缀
    const base64Data = imageBase64.split(',')[1] || imageBase64;
    const buffer = Buffer.from(base64Data, 'base64');
    
    // 检测图片格式
    let ext = 'jpg';
    if (imageBase64.includes('data:image/png')) {
      ext = 'png';
    } else if (imageBase64.includes('data:image/webp')) {
      ext = 'webp';
    }
    
    const tmpFile = join(tmpdir(), `paddleocr_${Date.now()}.${ext}`);
    await writeFile(tmpFile, new Uint8Array(buffer));
    
    // 中文（语文作文）直接走云端 PP-OCRv5：其模型默认支持中英混排，
    // 本地 .venv 的 lang='en' 模型不认中文，且本地中文模型下载在沙箱不稳定。
    // 英文保持"本地词级框优先 → 云端回退"，词框更贴合字迹。
    const useLocal = lang !== 'ch';
    if (useLocal) {
      const local = await runLocalOCR(tmpFile);
      if (local.success) {
        console.log(`✅ 本地 PaddleOCR 完成，共 ${local.words.length} 个词`);
        return { success: true, words: local.words };
      }
      console.log(`⚠️ 本地 OCR 不可用（${local.error}），回退 cloud PaddleOCR`);
    } else {
      console.log('📝 语文作文：直接走云端 PP-OCRv5（中英混排）');
    }

    console.log('📝 调用 PaddleOCR API...', tmpFile);
    const startTime = Date.now();

    // 调用 OCR API
    const result = await getClient().ocr({
      filePath: tmpFile,
      model: Model.PPOCRv5,  // 使用 PP-OCRv5
      options: {
        // det_db_unclip_ratio：越小检测框越紧贴字迹。默认约 1.6 会让词框过宽过高
        textDetUnclipRatio: 1.3,
      },
    });

    const elapsed = Date.now() - startTime;
    console.log(`✅ PaddleOCR 完成 (${elapsed}ms)`);

    // 解析结果（PP-OCRv5 返回行级：prunedResult.dt_polys + rec_texts + rec_scores）
    const words: WordBox[] = [];
    let allLines: { text: string; poly: number[][]; score: number }[] = [];

    if (result.pages && result.pages.length > 0) {
      for (const page of result.pages) {
        const pruned = (page as any).prunedResult || (page as any).raw?.prunedResult;
        if (!pruned) continue;

        const polys: number[][][] = pruned.dt_polys || [];
        const texts: string[] = pruned.rec_texts || [];
        const scores: number[] = pruned.rec_scores || [];

        for (let i = 0; i < texts.length; i++) {
          const poly = polys[i];
          const text = texts[i];
          const score = scores[i] || 0;
          if (!poly || !text) continue;
          allLines.push({ text, poly, score });
        }
      }
    }

    // 行内词级分割：按每个词字符数比例分配行宽
    for (const line of allLines) {
      const poly = line.poly;
      // 四点多边形 [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]：左上、右上、右下、左下
      const x1 = Math.min(poly[0][0], poly[3][0]);
      const x2 = Math.max(poly[1][0], poly[2][0]);
      const y1 = Math.min(poly[0][1], poly[1][1]);
      const y2 = Math.max(poly[3][1], poly[2][1]);
      const width = x2 - x1;

      const tokens = line.text.split(/\s+/).filter(Boolean);
      if (tokens.length <= 1) {
        const h = Math.round((y2 - y1) * BOX_VERTICAL_SHRINK);
        const bottom = Math.round(y1) + h;
        words.push({
          text: line.text,
          bbox: [Math.round(x1), Math.round(y1), Math.round(x2), bottom],
          x: Math.round(x1),
          y: Math.round(y1),
          width: Math.round(x2 - x1),
          height: h,
          confidence: line.score,
        });
        continue;
      }

      // 按词字符数比例分配行宽（忽略空格差异）
      const totalChars = tokens.reduce((s, w) => s + w.length, 0);
      const h = Math.round((y2 - y1) * BOX_VERTICAL_SHRINK);
      const bottom = Math.round(y1) + h;
      let cursor = x1;
      for (const token of tokens) {
        const ratio = token.length / totalChars;
        const wordRight = cursor + width * ratio;
        words.push({
          text: token,
          bbox: [Math.round(cursor), Math.round(y1), Math.round(wordRight), bottom],
          x: Math.round(cursor),
          y: Math.round(y1),
          width: Math.round(wordRight - cursor),
          height: h,
          confidence: line.score,
        });
        cursor = wordRight;
      }
    }

    console.log(`✅ PaddleOCR 解析完成，共 ${words.length} 个词（${allLines.length} 行）`);

    return {
      success: true,
      words,
    };
  } catch (error: any) {
    console.error('❌ PaddleOCR 调用失败:', error.message);
    return {
      success: false,
      words: [],
      error: error.message,
    };
  }
}
