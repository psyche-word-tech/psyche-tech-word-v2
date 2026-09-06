import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Router } from 'express';
import sharp from 'sharp';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { optionalAuthMiddleware } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import OcrApi20210707, * as $OcrApi20210707 from '@alicloud/ocr-api20210707';
import * as $OpenApi from '@alicloud/openapi-client';

// 加载环境变量 - 使用 process.cwd() 获取当前工作目录
dotenv.config({ path: path.join(process.cwd(), '.env') });

const router = Router();

// 千问 API 配置（使用函数延迟读取环境变量）
function getQwenApiKey() {
  return process.env.QWEN_API_KEY || '';
}
function getQwenApiUrl() {
  return process.env.QWEN_API_URL || 'https://ws-93mjw4d2mm946w5o.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions';
}
function getQwenModel() {
  return process.env.QWEN_MODEL || 'qwen3.7-plus';
}

// 阿里云 OCR 配置（使用函数延迟读取环境变量）
function getAlibabaCloudAccessKeyId() {
  return process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || '';
}
function getAlibabaCloudAccessKeySecret() {
  return process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || '';
}
const OCR_ENDPOINT = 'ocr-api.cn-hangzhou.aliyuncs.com';

interface ErrorAnnotation {
  type: 'grammar' | 'spelling' | 'punctuation' | 'word_choice' | 'sentence_structure';
  original: string;
  correction: string;
  explanation: string;
}

interface OCRWord {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GradingResult {
  total_score: number;
  max_score: number;
  scores: {
    content: number;
    language: number;
    structure: number;
    handwriting: number;
  };
  errors: ErrorAnnotation[];
  comments: string;
  strengths: string[];
  improvements: string[];
}

/**
 * POST /api/v1/essay-grading/grade
 * 批改英语作文
 */
router.post('/grade', optionalAuthMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { image, reference_answer, max_score = 15 } = req.body;

    if (!image) {
      return res.status(400).json({ success: false, error: '缺少作文图片' });
    }

    // 参考答案可选
    const refAnswer = reference_answer || '';

    // 1. 先调用 Qwen3.5-OCR 识别文字位置
    let ocrWords: OCRWord[] = [];
    try {
      console.log('调用 Qwen3.5-OCR 识别文字位置...');
      ocrWords = await callQwenOCR(image);
      console.log(`OCR 识别到 ${ocrWords.length} 个单词`);
    } catch (err) {
      console.error('Qwen OCR 调用失败:', err);
      console.log('使用位置估算方案');
    }

    // 2. 调用千问 VL 模型批改作文
    console.log('开始调用千问 VL 模型批改作文...');
    const gradingResult = await callQwenVL(image, refAnswer, max_score);
    console.log('千问 VL 模型批改完成');

    // 计算总分
    gradingResult.total_score = gradingResult.scores.content + gradingResult.scores.language + gradingResult.scores.structure + gradingResult.scores.handwriting;
    gradingResult.max_score = max_score;

    // 3. 在原图上标注错误（使用 OCR 精确位置）
    const markedImage = await annotateImage(image, gradingResult.errors, ocrWords);

    // 保存到数据库
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('essay_grading_results')
      .insert({
        user_id: String(userId),
        original_image: image,
        marked_image: markedImage,
        reference_answer,
        grading_result: gradingResult,
        max_score,
      })
      .select()
      .single();

    if (error) {
      console.error('保存批改结果失败:', error);
    }

    res.json({
      success: true,
      data: {
        id: data?.id,
        grading: gradingResult,
        marked_image: markedImage,
      },
    });
  } catch (error: any) {
    console.error('作文批改失败:', error);
    res.status(500).json({ success: false, error: error.message || '批改失败' });
  }
});

/**
 * 调用 Qwen3.5-OCR 模型识别文字位置
 */
async function callQwenOCR(imageBase64: string): Promise<OCRWord[]> {
  const prompt = `请识别图片中的所有英文单词，并返回每个单词的位置坐标。

## 输出格式（JSON）
请严格按照以下 JSON 格式输出，不要输出其他内容：
{
  "words": [
    {
      "text": "单词文本",
      "x": 左上角 x 坐标（像素）,
      "y": 左上角 y 坐标（像素）,
      "width": 宽度（像素）,
      "height": 高度（像素）
    }
  ]
}

## 要求
1. 识别所有英文单词（包括标点符号）
2. 返回每个单词的精确位置坐标
3. 坐标单位为像素，相对于原图`;

  const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getQwenApiKey()}`,
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
                url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Qwen OCR API 调用失败: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Qwen OCR API 返回内容为空');
  }

  // 解析 JSON 响应
  try {
    const result = JSON.parse(content);
    // 处理 Qwen3.5-OCR 返回的 rotate_rect 格式
    if (Array.isArray(result)) {
      return result.map((item: any) => {
        if (item.rotate_rect) {
          const [x1, y1, x2, y2] = item.rotate_rect;
          return {
            text: item.text,
            x: Math.min(x1, x2),
            y: Math.min(y1, y2),
            width: Math.abs(x2 - x1),
            height: Math.abs(y2 - y1),
          };
        }
        return item;
      });
    }
    return result.words || [];
  } catch {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      // 处理 Qwen3.5-OCR 返回的 rotate_rect 格式
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => {
          if (item.rotate_rect) {
            const [x1, y1, x2, y2] = item.rotate_rect;
            return {
              text: item.text,
              x: Math.min(x1, x2),
              y: Math.min(y1, y2),
              width: Math.abs(x2 - x1),
              height: Math.abs(y2 - y1),
            };
          }
          return item;
        });
      }
      return parsed.words || [];
    }
    throw new Error('Qwen OCR API 返回格式错误');
  }
}

/**
 * 调用千问 VL 模型
 */
async function callQwenVL(imageBase64: string, referenceAnswer: string, maxScore: number): Promise<GradingResult> {
  const prompt = `你是一位经验丰富的英语教师，请仔细批改这篇英语作文。

## 参考答案
${referenceAnswer}

## 批改要求
1. 对照参考答案，仔细检查作文内容
2. **找出所有错误**，不要遗漏任何错误！包括：
   - 语法错误（时态、主谓一致、冠词等）
   - 拼写错误
   - 标点错误
   - 用词不当
   - 句式问题
3. 给出详细分数（满分${maxScore}分）：
   - 内容分（40%）：是否涵盖要点
   - 语言分（30%）：语法、拼写、词汇
   - 结构分（20%）：段落组织、逻辑连贯
   - 书写分（10%）：字迹工整度
4. 给出具体修改建议和评语

## 输出格式（JSON）
请严格按照以下 JSON 格式输出，不要输出其他内容：
{
  "max_score": ${maxScore},
  "scores": {
    "content": 内容分,
    "language": 语言分,
    "structure": 结构分,
    "handwriting": 书写分
  },
  "errors": [
    {
      "type": "grammar/spelling/punctuation/word_choice/sentence_structure",
      "original": "错误原文",
      "correction": "正确写法",
      "explanation": "错误原因说明",
      "bbox": [x1, y1, x2, y2]
    }
  ],
  "comments": "总体评语",
  "strengths": ["优点1", "优点2"],
  "improvements": ["改进建议 1", "改进建议 2"]
}

## 重要
- bbox 是错误单词在图片中的坐标 [左上角 x, 左上角 y, 右下角 x, 右下角 y]
- 坐标范围：x 从 0 到图片宽度，y 从 0 到图片高度
- 仔细观察图片，准确定位每个错误单词的位置
- 如果无法确定精确位置，给出大致位置即可
`;

  console.log('调用千问 VL 模型，API URL:', getQwenApiUrl());
  console.log('模型:', getQwenModel());
  console.log('API Key 长度:', getQwenApiKey().length);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 秒超时

  let response;
  try {
    response = await fetch(getQwenApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getQwenApiKey()}`,
      },
      body: JSON.stringify({
        model: getQwenModel(),
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 4096,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('千问 API 调用超时（120秒）');
    }
    throw err;
  }

  console.log('千问 VL 模型响应状态:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`千问 API 调用失败: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('千问 API 返回内容为空');
  }

  // 解析 JSON 响应
  let gradingResult: GradingResult;
  try {
    // 尝试直接解析
    gradingResult = JSON.parse(content);
    // 写入文件日志
    const fs = await import('fs');
    fs.writeFileSync('/tmp/qwen-response.log', JSON.stringify(gradingResult, null, 2));
    console.log('千问 VL 模型响应已写入 /tmp/qwen-response.log');
  } catch {
    // 尝试从 markdown 代码块中提取 JSON
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      gradingResult = JSON.parse(jsonMatch[1]);
    } else {
      // 尝试找到 JSON 对象
      const objMatch = content.match(/\{[\s\S]*\}/);
      if (objMatch) {
        gradingResult = JSON.parse(objMatch[0]);
      } else {
        throw new Error('无法解析千问 API 返回的 JSON');
      }
    }
  }

  return gradingResult;
}

/**
 * 在原图上标注错误（使用 OCR 精确位置）
 */
async function annotateImage(imageBase64: string, errors: ErrorAnnotation[], ocrWords: OCRWord[] = []): Promise<string> {
  try {
    console.log('[annotateImage] 开始处理...');
    const base64Data = imageBase64.split(',')[1] || imageBase64;
    const buffer = Buffer.from(base64Data, 'base64');
    console.log('[annotateImage] Buffer 创建完成，大小:', buffer.length);
    
    // 获取图片尺寸
    console.log('[annotateImage] 开始获取图片元数据...');
    const metadata = await sharp(buffer).metadata();
    console.log('[annotateImage] 元数据获取完成:', metadata.width, 'x', metadata.height);
    const width = metadata.width || 800;
    const height = metadata.height || 600;

    // 创建 SVG 标注层
    let svgAnnotations = '';
    const color = '#FF0000'; // 红色（像老师用红笔）

    // 根据图片分辨率动态调整标注大小
    const scale = Math.min(width, height) / 1000; // 缩放因子（基于 1000px 基准）
    const totalLines = 10;
    const paddingTop = 60 * scale;
    const paddingBottom = 40 * scale;
    const paddingLeft = 40 * scale;
    const lineHeight = (height - paddingTop - paddingBottom) / totalLines;

    errors.forEach((error, index) => {
      // 使用千问 VL 模型返回的 bbox 坐标
      let x = 0, y = 0, wordWidth = 50 * scale, wordHeight = 30 * scale;
      
      if ((error as any).bbox && Array.isArray((error as any).bbox) && (error as any).bbox.length === 4) {
        const [x1, y1, x2, y2] = (error as any).bbox;
        x = x1;
        y = y1;
        wordWidth = x2 - x1;
        wordHeight = y2 - y1;
        console.log(`[annotateImage] 使用 bbox 位置：${error.original} at (${x}, ${y}, ${wordWidth}, ${wordHeight})`);
      } else {
        // 如果没有 bbox，使用位置估算
        const avgWordWidth = 50 * scale;
        const line = (error as any).line || 1;
        const wordIndex = (error as any).wordIndex || 1;
        
        x = paddingLeft + (wordIndex - 1) * avgWordWidth;
        y = paddingTop + (line - 1) * lineHeight;
        wordWidth = avgWordWidth;
        wordHeight = lineHeight * 0.5;
        console.log(`[annotateImage] 使用估算位置：${error.original} at line ${line}, word ${wordIndex}`);
      }
      
      // 1. 在错误单词上画删除线（红色横线，加粗）
      svgAnnotations += `
        <line x1="${x}" y1="${y + wordHeight / 2}" x2="${x + wordWidth}" y2="${y + wordHeight / 2}" 
              stroke="${color}" stroke-width="${3 * scale}"/>
      `;
      
      // 2. 在错误单词上方画圆圈标记（根据分辨率调整大小）
      const circleX = x + wordWidth / 2;
      const circleY = y - 15 * scale;
      const circleFontSize = lineHeight * 0.2; // 圆圈中数字字体与批注字体一致
      svgAnnotations += `
        <circle cx="${circleX}" cy="${circleY}" r="${12 * scale}" fill="none" stroke="${color}" stroke-width="${2 * scale}"/>
        <text x="${circleX}" y="${circleY + 5 * scale}" font-size="${circleFontSize}" fill="${color}" text-anchor="middle" font-weight="bold">
          ${index + 1}
        </text>
      `;
      
      // 3. 在旁边写正确的单词（红色，斜体，字体大小为原字体的 0.6 倍）
      if (error.correction && error.correction !== error.original) {
        const correctionX = x + wordWidth + 8 * scale;
        const correctionY = y - 8 * scale;
        const correctionFontSize = lineHeight * 0.2; // 进一步减小字体
        svgAnnotations += `
          <text x="${correctionX}" y="${correctionY}" font-size="${correctionFontSize}" fill="${color}" font-style="italic" font-family="Arial" font-weight="bold">
            ${error.correction}
          </text>
        `;
      }
    });

    // 在图片底部添加标注列表（进一步增大字体）
    const listStartY = height + 20;
    const listHeight = errors.length * 50 + 80;
    
    let listSvg = `
      <rect x="0" y="${height}" width="${width}" height="${listHeight}" fill="#FFF9E6"/>
      <line x1="0" y1="${height}" x2="${width}" y2="${height}" stroke="#FFCC00" stroke-width="4"/>
      <text x="20" y="${listStartY}" font-size="28" fill="#333" font-family="Arial" font-weight="bold">
        批改标注：
      </text>
    `;
    
    errors.forEach((error, index) => {
      const itemY = listStartY + 45 + index * 50;
      listSvg += `
        <text x="20" y="${itemY}" font-size="24" fill="${color}" font-family="Arial" font-weight="bold">
          ${index + 1}. ${error.original} → ${error.correction}
        </text>
      `;
    });

    // 使用 sharp 的 extend + composite 方法
    console.log('使用 sharp 生成标注图片...');
    
    // 1. 扩展原图高度（底部添加黄色背景）
    const extendedBuffer = await sharp(buffer)
      .extend({
        bottom: listHeight,
        background: { r: 255, g: 249, b: 230, alpha: 1 }
      })
      .toBuffer();
    
    // 2. 创建 SVG 标注层（只包含标注，不包含原图）
    const svgOverlay = `
      <svg width="${width}" height="${height + listHeight}">
        ${svgAnnotations}
        ${listSvg}
      </svg>
    `;
    
    // 3. 将 SVG 标注层叠加到扩展后的原图上
    const annotatedBuffer = await sharp(extendedBuffer)
      .composite([{
        input: Buffer.from(svgOverlay),
        top: 0,
        left: 0
      }])
      .png()
      .toBuffer();
    
    return `data:image/png;base64,${annotatedBuffer.toString('base64')}`;
  } catch (error) {
    console.error('图片标注失败:', error);
    return imageBase64; // 标注失败返回原图
  }
}

function getErrorTypeName(type: string): string {
  const names: Record<string, string> = {
    grammar: '语法',
    spelling: '拼写',
    punctuation: '标点',
    word_choice: '用词',
    sentence_structure: '句式',
  };
  return names[type] || type;
}

/**
 * GET /api/v1/essay-grading/history
 * 获取批改历史
 */
router.get('/history', optionalAuthMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('essay_grading_results')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    res.json({ success: true, data });
  } catch (error: any) {
    console.error('获取批改历史失败:', error);
    res.status(500).json({ success: false, error: error.message || '获取失败' });
  }
});

/**
 * GET /api/v1/essay-grading/:id
 * 获取单次批改详情
 */
router.get('/:id', optionalAuthMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('essay_grading_results')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      throw error;
    }

    res.json({ success: true, data });
  } catch (error: any) {
    console.error('获取批改详情失败:', error);
    res.status(500).json({ success: false, error: error.message || '获取失败' });
  }
});

export default router;
