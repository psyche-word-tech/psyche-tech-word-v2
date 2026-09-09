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
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

// 词框(行框)纵向 padding 收缩比例：PP-OCRv5 行框上下常带多余空白，
// 以顶边为锚把高度收窄到字迹区，使"词框最低点"贴近真实字迹底。
const BOX_VERTICAL_SHRINK = 0.72;

/**
 * 调用 PaddleOCR 获取词级坐标
 */
export async function callPaddleOCR(imageBase64: string): Promise<{
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
    await writeFile(tmpFile, buffer);
    
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
