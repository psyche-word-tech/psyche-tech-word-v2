const AlibabaOCR = require('@alicloud/ocr-api20210707');
const OpenApi = require('@alicloud/openapi-client');

export interface WordBox {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function callAlibabaOCR(
  imageBase64: string,
  isUrl: boolean = false
): Promise<WordBox[]> {
  const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;

  if (!accessKeyId || !accessKeySecret) {
    throw new Error('阿里云 AccessKey 未配置');
  }

  console.log('[AliyunOCR] 调用 API (RecognizeGeneral)...');

  // 创建客户端
  const config = new OpenApi.Config({
    accessKeyId,
    accessKeySecret,
    endpoint: 'ocr-api.cn-hangzhou.aliyuncs.com',
  });

  const client = new AlibabaOCR.default(config);

  // 创建请求
  const request = new AlibabaOCR.RecognizeGeneralRequest({
    body: isUrl ? undefined : imageBase64,
    url: isUrl ? imageBase64 : undefined,
  });

  // 调用 API
  const response = await client.recognizeGeneral(request);

  console.log('[AliyunOCR] API 调用成功');

  // 解析响应
  const words: WordBox[] = [];

  if (response.body?.data?.prism_wordsInfo) {
    for (const item of response.body.data.prism_wordsInfo) {
      const text = item.word || '';
      const pos = item.pos;

      if (pos && pos.x !== undefined && pos.y !== undefined) {
        const x0 = pos.x;
        const y0 = pos.y;
        const x1 = pos.x2 || pos.x;
        const y1 = pos.y2 || pos.y;

        // 分割成单词
        const lineWords = text.split(/\s+/).filter(w => w.length > 0);
        const lineWidth = x1 - x0;
        const wordWidth = lineWidth / lineWords.length;

        lineWords.forEach((word, idx) => {
          words.push({
            text: word,
            x: x0 + idx * wordWidth,
            y: y0,
            width: wordWidth,
            height: y1 - y0,
          });
        });
      }
    }
  }

  console.log('[AliyunOCR] 识别完成，返回', words.length, '个单词');
  return words;
}
