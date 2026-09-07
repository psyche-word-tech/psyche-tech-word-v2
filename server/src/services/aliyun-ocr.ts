import crypto from 'crypto';

interface WordBox {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface OCRResult {
  words: WordBox[];
  lines: { text: string; x0: number; y0: number; x1: number; y1: number }[];
}

/**
 * 调用阿里云 OCR 获取文字坐标（使用通用文字识别）
 * @param imageBase64 图片 base64（不含 data:image/jpeg;base64, 前缀）或图片 URL
 */
export async function callAliyunOCR(imageBase64: string): Promise<OCRResult> {
  const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;

  if (!accessKeyId || !accessKeySecret) {
    throw new Error('阿里云 AccessKey 未配置');
  }

  // 判断是 URL 还是 base64
  const isUrl = imageBase64.startsWith('http://') || imageBase64.startsWith('https://');

  // 阿里云 OpenAPI 签名参数（使用 RecognizeGeneral - 通用文字识别）
  const params: Record<string, string> = {
    Action: 'RecognizeGeneral',
    Format: 'JSON',
    Version: '2021-07-07',
    AccessKeyId: accessKeyId,
    SignatureMethod: 'HMAC-SHA1',
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    SignatureVersion: '1.0',
    SignatureNonce: crypto.randomUUID(),
  };

  if (isUrl) {
    params.Url = imageBase64;
  } else {
    params.body = imageBase64;
  }

  // 添加时间戳（必须在签名计算之前）
  const now = new Date();
  params['Timestamp'] = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  params['SignatureNonce'] = crypto.randomUUID();
  
  // 计算签名
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  const stringToSign = `POST&${encodeURIComponent('/')}&${encodeURIComponent(sortedParams)}`;
  const signature = crypto
    .createHmac('sha1', `${accessKeySecret}&`)
    .update(stringToSign)
    .digest('base64');

  params.Signature = signature;

  console.log('[AliyunOCR] 调用 API (RecognizeGeneral)...');

  const response = await fetch('https://ocr-api.cn-hangzhou.aliyuncs.com/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: Object.keys(params)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&'),
  });

  const rawText = await response.text();
  console.log('[AliyunOCR] 原始响应长度:', rawText.length);

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`阿里云 OCR 返回非 JSON 格式：${rawText.substring(0, 200)}`);
  }

  const words: WordBox[] = [];
  const lines: { text: string; x0: number; y0: number; x1: number; y1: number }[] = [];

  // 解析响应
  if (data.Data) {
    const content = typeof data.Data === 'string' ? JSON.parse(data.Data) : data.Data;
    console.log('[AliyunOCR] Content keys:', Object.keys(content));
    console.log('[AliyunOCR] Content sample:', JSON.stringify(content).substring(0, 500));

    // 尝试多种可能的字段名
    const wordsInfo = content.prism_wordsInfo || content.wordsInfo || content.words || [];
    const linesInfo = content.prism_linesInfo || content.linesInfo || content.lines || [];

    if (wordsInfo.length > 0) {
      console.log('[AliyunOCR] 第一个单词示例:', JSON.stringify(wordsInfo[0]));
      for (const item of wordsInfo) {
        if (item.word) {
          // 检查 pos 的不同格式
          let x0 = 0, y0 = 0, x1 = 0, y1 = 0;
          if (item.pos) {
            if (item.pos.x !== undefined) {
              x0 = item.pos.x;
              y0 = item.pos.y;
              x1 = item.pos.x + (item.pos.width || 0);
              y1 = item.pos.y + (item.pos.height || 0);
            } else if (item.pos.x1 !== undefined) {
              x0 = item.pos.x1;
              y0 = item.pos.y1;
              x1 = item.pos.x2;
              y1 = item.pos.y2;
            } else if (Array.isArray(item.pos)) {
              // 四点坐标格式
              x0 = Math.min(...item.pos.map((p: any) => p.x || p[0]));
              y0 = Math.min(...item.pos.map((p: any) => p.y || p[1]));
              x1 = Math.max(...item.pos.map((p: any) => p.x || p[0]));
              y1 = Math.max(...item.pos.map((p: any) => p.y || p[1]));
            }
          }
          words.push({ text: item.word, x0, y0, x1, y1 });
        }
      }
    }

    if (linesInfo.length > 0) {
      for (const item of linesInfo) {
        if (item.line && item.pos) {
          lines.push({
            text: item.line,
            x0: item.pos.x || 0,
            y0: item.pos.y || 0,
            x1: (item.pos.x || 0) + (item.pos.width || 0),
            y1: (item.pos.y || 0) + (item.pos.height || 0),
          });
        }
      }
    }
  }

  console.log('[AliyunOCR] 解析结果：单词数 =', words.length, '行数 =', lines.length);

  return { words, lines };
}
