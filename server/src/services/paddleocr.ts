import { PaddleOCRClient, Model } from '@paddleocr/api-sdk';
import { writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

let client: PaddleOCRClient | null = null;

function getClient(): PaddleOCRClient {
  if (!client) {
    const token = process.env.PADDLEOCR_ACCESS_TOKEN || '';
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
  confidence: number;
}

/**
 * 调用 PaddleOCR 获取词级坐标
 */
export async function callPaddleOCR(imageBase64: string): Promise<{
  success: boolean;
  words: WordBox[];
  error?: string;
}> {
  try {
    // 将 base64 写入临时文件
    const buffer = Buffer.from(imageBase64, 'base64');
    const tmpFile = join(tmpdir(), `paddleocr_${Date.now()}.jpg`);
    await writeFile(tmpFile, buffer);

    console.log('📝 调用 PaddleOCR API...');
    const startTime = Date.now();

    // 调用 OCR API
    const result = await getClient().ocr({
      filePath: tmpFile,
      model: Model.PPOCRv5,  // 使用 PP-OCRv5
    });

    const elapsed = Date.now() - startTime;
    console.log(`✅ PaddleOCR 完成 (${elapsed}ms)`);

    // 解析结果
    const words: WordBox[] = [];
    
    if (result.pages && result.pages.length > 0) {
      for (const page of result.pages) {
        if (page.detectionResults) {
          for (const det of page.detectionResults) {
            const text = det.text || '';
            const confidence = det.confidence || 0;
            
            // bbox 格式：[[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
            if (det.bbox && Array.isArray(det.bbox) && det.bbox.length >= 4) {
              const x1 = Math.round(det.bbox[0][0]);
              const y1 = Math.round(det.bbox[0][1]);
              const x2 = Math.round(det.bbox[2][0]);
              const y2 = Math.round(det.bbox[2][1]);
              
              words.push({
                text,
                bbox: [x1, y1, x2, y2],
                confidence,
              });
            }
          }
        }
      }
    }

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
