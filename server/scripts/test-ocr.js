#!/usr/bin/env node
/**
 * 测试 qwen3.5-ocr 模型返回的 bbox 格式
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') });

const QWEN_API_KEY = process.env.QWEN_API_KEY;
const QWEN_API_URL = process.env.QWEN_API_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';

async function testQwenOCR() {
  console.log('=== 测试 qwen3.5-ocr 模型 ===\n');
  
  // 使用一个测试图片（作文图片）
  const testImageUrl = 'https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20241108/ctdzex/biaozhun.jpg';
  
  const prompt = `请识别图片中的所有文字，并返回每个单词的位置坐标。
要求返回 JSON 格式，包含：
- text: 文字内容
- bbox: 坐标 [x1, y1, x2, y2] 或 [cx, cy, width, height, angle]

请尽量返回每个单词的独立坐标，而不是整行坐标。`;

  try {
    console.log('调用 qwen3.5-ocr 模型...');
    console.log('API URL:', QWEN_API_URL);
    console.log('图片 URL:', testImageUrl);
    console.log();

    const response = await fetch(`${QWEN_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${QWEN_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'qwen3.5-ocr',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: testImageUrl,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API 调用失败:', response.status, errorText);
      return;
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    console.log('=== 返回结果 ===\n');
    console.log(content);
    console.log('\n=== 结果分析 ===\n');
    
    // 尝试解析 JSON
    try {
      // 提取 JSON 部分
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log(`✅ 返回了 ${parsed.length} 个文字块`);
        
        if (parsed.length > 0) {
          const first = parsed[0];
          console.log('\n第一个文字块示例:');
          console.log(JSON.stringify(first, null, 2));
          
          if (first.bbox) {
            console.log('\n坐标格式分析:');
            if (first.bbox.length === 4) {
              console.log('  - 4 个值：可能是 [x1, y1, x2, y2] 或 [cx, cy, width, height]');
            } else if (first.bbox.length === 5) {
              console.log('  - 5 个值：可能是 [cx, cy, width, height, angle]');
            }
            
            // 判断是行级还是词级
            const avgWidth = parsed.reduce((sum, item) => {
              if (item.bbox.length >= 4) {
                const width = item.bbox[2] - item.bbox[0];
                return sum + width;
              }
              return sum;
            }, 0) / parsed.length;
            
            console.log(`\n  - 平均宽度：${avgWidth.toFixed(1)} 像素`);
            console.log(`  - 如果是词级坐标，平均宽度应该较小（<100px）`);
            console.log(`  - 如果是行级坐标，平均宽度应该较大（>200px）`);
          }
        }
      } else {
        console.log('⚠️  返回内容不是 JSON 格式，可能是自由文本');
        console.log('这说明模型没有按结构化格式返回坐标');
      }
    } catch (e) {
      console.log('⚠️  无法解析 JSON，返回的是自由文本格式');
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

testQwenOCR();
