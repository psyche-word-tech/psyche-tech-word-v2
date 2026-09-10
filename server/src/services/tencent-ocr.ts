import { createHmac, createHash } from 'node:crypto';
import type { WordBox } from './paddleocr';

// 腾讯云「中英文手写作文识别」HandwritingEssayOCR 词级坐标服务。
// 返回按行分块，行内 WordCoord[] 为逐词精确坐标（紧贴字迹、按空白切词、标点单独成块），
// 正是"上下紧贴 + 按空白聚合 + 提供坐标"的方案。纯 HTTP + 原生 fetch，无本地模型，
// 无第三方 SDK 依赖，可稳定部署到 Railway。
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

const SERVICE = 'ocr';
const VERSION = '2018-11-19';
const ACTION = 'HandwritingEssayOCR';
const HOST = 'ocr.tencentcloudapi.com';
const ENDPOINT = `https://${HOST}`;

// ---------- 腾讯云 TC3-HMAC-SHA256 签名 ----------
function hmacSha256(key: Buffer | string, msg: string): Buffer {
  return createHmac('sha256', key).update(msg).digest();
}

function sha256Hex(msg: string): string {
  return createHash('sha256').update(msg).digest('hex');
}

function signTc3(
  secretId: string,
  secretKey: string,
  service: string,
  action: string,
  region: string,
  payload: string
): { authorization: string; timestamp: string } {
  const now = new Date();
  const timestamp = Math.floor(now.getTime() / 1000).toString();
  const date = now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${HOST}\nx-tc-action:${action.toLowerCase()}\n`;
  const signedHeaders = 'content-type;host;x-tc-action';
  const hashedPayload = sha256Hex(payload);
  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    signedHeaders,
    hashedPayload,
  ].join('\n');

  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = [
    'TC3-HMAC-SHA256',
    timestamp,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const secretDate = hmacSha256('TC3' + secretKey, date);
  const secretService = hmacSha256(secretDate, service);
  const secretSigning = hmacSha256(secretService, 'tc3_request');
  const signature = hmacSha256(secretSigning, stringToSign).toString('hex');

  const authorization =
    `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return { authorization, timestamp };
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
  const secretId = process.env.TENCENT_SECRET_ID;
  const secretKey = process.env.TENCENT_SECRET_KEY;
  if (!secretId || !secretKey) {
    throw new Error('TENCENT_SECRET_ID / TENCENT_SECRET_KEY 未配置');
  }
  const region = process.env.TENCENT_OCR_REGION || 'ap-guangzhou';
  const configId = CONFIG_BY_LANG[lang] || CONFIG_BY_LANG.en;
  const base64Data = imageBase64.split(',')[1] || imageBase64;

  const payload = JSON.stringify({
    ImageBase64: base64Data,
    ConfigId: configId,
  });
  const { authorization, timestamp } = signTc3(secretId, secretKey, SERVICE, ACTION, region, payload);

  const start = Date.now();
  const resp = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json; charset=utf-8',
      Host: HOST,
      'X-TC-Action': ACTION,
      'X-TC-Version': VERSION,
      'X-TC-Timestamp': timestamp,
      'X-TC-Region': region,
    },
    body: payload,
    signal: AbortSignal.timeout(60_000),
  });

  const textResp = await resp.text();
  let json: any;
  try {
    json = JSON.parse(textResp);
  } catch {
    throw new Error(`腾讯云 OCR HTTP ${resp.status}，响应非 JSON: ${textResp.slice(0, 200)}`);
  }

  if (!resp.ok || json.Response?.Error) {
    const err = json.Response?.Error;
    throw new Error(
      `腾讯云 OCR 失败 HTTP ${resp.status}: ${err?.Code || ''} ${err?.Message || textResp.slice(0, 200)}`
    );
  }

  const respBody = json.Response;
  const lines = respBody?.WordList || [];
  const words: WordBox[] = [];
  for (const line of lines) {
    words.push(...wordsFromLine(line));
  }
  console.log(`✅ 腾讯云 HandwritingEssayOCR(${configId}) 完成，${lines.length} 行 / ${words.length} 词，耗时 ${Date.now() - start}ms`);
  return words;
}