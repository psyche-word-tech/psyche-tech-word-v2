import FormData from 'form-data';

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
  console.log('[OCR] 调用本地 OCR 服务...');
  
  try {
    // 将 base64 转换为 buffer
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    
    // 创建 FormData
    const formData = new FormData();
    formData.append('file', imageBuffer, {
      filename: 'image.jpg',
      contentType: 'image/jpeg',
    });
    
    // 调用本地 OCR 服务
    const response = await fetch('http://localhost:8000/api/ocr', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error('OCR 服务调用失败');
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'OCR 识别失败');
    }
    
    console.log('[OCR] 识别完成，返回', result.count, '个单词');
    return result.words;
    
  } catch (error) {
    console.error('[OCR] 调用失败:', error);
    throw error;
  }
}
