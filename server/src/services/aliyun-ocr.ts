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
 * @param imageBase64 图片 base64（不含 data:image/jpeg;base64, 前缀）
 */
export async function callAliyunOCR(imageBase64: string): Promise<OCRResult> {
  const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;

  if (!accessKeyId || !accessKeySecret) {
    throw new Error('阿里云 AccessKey 未配置');
  }

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
    Body: imageBase64,
  };

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

  console.log('[AliyunOCR] 调用 API (RecognizeBasic)...');

  const response = await fetch('https://ocr-api.cn-hangzhou.aliyuncs.com/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: Object.keys(params)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&'),
  });

  const data = await response.json();
  console.log('[AliyunOCR] 响应:', JSON.stringify(data, null, 2));

  const words: WordBox[] = [];
  const lines: { text: string; x0: number; y0: number; x1: number; y1: number }[] = [];

  // 解析响应
  if (data.Data && data.Data.Content) {
    const content = JSON.parse(data.Data.Content);
    console.log('[AliyunOCR] Content:', content);

    // 解析普片文字识别结果
    if (content.prism_wordsInfo) {
      for (const item of content.prism_wordsInfo) {
        if (item.word && item.pos) {
          words.push({
            text: item.word,
            x0: item.pos.x || 0,
            y0: item.pos.y || 0,
            x1: (item.pos.x || 0) + (item.pos.width || 0),
            y1: (item.pos.y || 0) + (item.pos.height || 0),
          });
        }
      }
    }

    if (content.prism_linesInfo) {
      for (const item of content.prism_linesInfo) {
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

  return { words, lines };
}
