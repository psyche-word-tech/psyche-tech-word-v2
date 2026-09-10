import tencentcloud from 'tencentcloud-sdk-nodejs-ocr';
import type { WordBox } from './paddleocr';

// 腾讯云「中英文手写作文识别」HandwritingEssayOCR 词级坐标服务。
// 返回按行分块，行内 WordCoord[] 为逐词精确坐标（紧贴字迹、按空白切词、标点单独成块），
// 正是"上下紧贴 + 按空白聚合 + 提供坐标"的方案。纯 HTTP，无本地模型，可部署到 Railway。
// 凭证：TENCENT_SECRET_ID / TENCENT_SECRET_KEY（server/.env，gitignore）。
export interface TencentConfig {
  secretId?: string;
  secretKey?: string;
  region?: string;
}

// 语文作文用简体中文配置，英语用英文配置（对应「中英文手写作文识别」两种 ConfigId）
const CONFIG_BY_LANG: Record<string, string> = {
  en: 'ArticleRecognizeEng',
  ch: 'ArticleRecognizeCmn',
};

let _client: any = null;

function getClient(): any {
  const secretId = process.env.TENCENT_SECRET_ID;
  const secretKey = process.env.TENCENT_SECRET_KEY;
  if (!secretId || !secretKey) {
    throw new Error('TENCENT_SECRET_ID / TENCENT_SECRET_KEY 未配置');
  }
  if (!_client) {
    const OcrClient = tencentcloud.ocr.v20181119.Client;
    _client = new OcrClient({
      credential: { secretId, secretKey },
      region: process.env.TENCENT_OCR_REGION || 'ap-guangzhou',
      profile: {
        httpProfile: { endpoint: 'ocr.tencentcloudapi.com', reqTimeout: 60_000 },
      },
    });
  }
  return _client;
}

// 把腾讯云某行分块展开成逐词 WordBox。
// 腾讯云 y 坐标向下为正：LeftTop 即 (left, top)，RightBottom 即 (right, bottom)。
function wordsFromLine(line: any): WordBox[] {
  const out: WordBox[] = [];
  for (const w of line.WordCoord || []) {
    const c = w.Coord;
    const x1 = c.LeftTop.X;
    const y1 = c.LeftTop.Y;
    const x2 = c.RightBottom.X;
    const y2 = c.RightBottom.Y;
    if (x2 < x1 || y2 < y1) continue;
    const text = String(w.DetectedText ?? '').trim();
    if (!text) continue;
    out.push({
      text,
      bbox: [x1, y1, x2, y2],
      x: x1,
      y: y1,
      width: x2 - x1,
      height: y2 - y1,
      confidence: 1,
    });
  }
  return out;
}

/**
 * 调用腾讯云 HandwritingEssayOCR 获取词级坐标。
 * lang: 'en' | 'ch'，决定用英文/中文作文 ConfigId。
 * 失败抛错，由调用方决定回退策略。
 */
export async function callTencentOcr(imageBase64: string, lang: string = 'en'): Promise<WordBox[]> {
  const configId = CONFIG_BY_LANG[lang] || CONFIG_BY_LANG.en;
  const base64Data = imageBase64.split(',')[1] || imageBase64;

  const client = getClient();
  const start = Date.now();
  const r = await client.HandwritingEssayOCR({
    ImageBase64: base64Data,
    ConfigId: configId,
  });
  const resp = r.HandwritingEssayOCRResponse || r;
  const lines = resp.WordList || [];
  const words: WordBox[] = [];
  for (const line of lines) {
    words.push(...wordsFromLine(line));
  }
  console.log(`✅ 腾讯云 HandwritingEssayOCR(${configId}) 完成，${lines.length} 行 / ${words.length} 词，耗时 ${Date.now() - start}ms`);
  return words;
}