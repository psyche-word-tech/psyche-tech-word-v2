import FormData from 'form-data';

export interface WordBox {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface OcrResponse {
  success: boolean;
  error?: string;
  count?: number;
  words?: WordBox[];
}

export async function callAlibabaOCR(
  imageBase64: string,
  isUrl: boolean = false
): Promise<WordBox[]> {
  console.log('[OCR] 调用本地 OCR 服务...');
  
  try {
    // 直接传递 base64
    const response = await fetch('http://localhost:8000/api/ocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: imageBase64,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error('OCR 服务调用失败：' + errorText);
    }
    
    const result = (await response.json()) as OcrResponse;
    
    if (!result.success) {
      throw new Error(result.error || 'OCR 识别失败');
    }
    
    console.log('[OCR] 识别完成，返回', result.count, '个单词');
    return result.words ?? [];
    
  } catch (error) {
    console.error('[OCR] 调用失败:', error);
    throw error;
  }
}
