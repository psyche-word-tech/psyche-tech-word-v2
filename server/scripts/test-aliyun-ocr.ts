// 测试阿里云 OCR 调用
import { callAliyunOCR } from '../src/services/aliyun-ocr.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testOCR() {
  console.log('=== 测试阿里云 OCR ===\n');
  console.log('AccessKey ID:', process.env.ALIBABA_CLOUD_ACCESS_KEY_ID?.substring(0, 10) + '...');

  // 使用示例图片 URL
  console.log('使用示例图片 URL...');
  const imageUrl = 'https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20241108/ctdzex/biaozhun.jpg';
  
  console.log('调用阿里云 OCR...');
  const result = await callAliyunOCR(imageUrl);
  
  console.log('\n=== 结果 ===');
  console.log('单词数:', result.words.length);
  console.log('行数:', result.lines.length);
  console.log('\n前 5 个单词:');
  result.words.slice(0, 5).forEach((w, i) => {
    console.log(`${i + 1}. "${w.text}" at (${w.x0}, ${w.y0}) - (${w.x1}, ${w.y1})`);
  });
}

testOCR().catch(console.error);
