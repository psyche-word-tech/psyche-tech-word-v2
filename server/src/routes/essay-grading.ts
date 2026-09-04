import { Router } from 'express';
import sharp from 'sharp';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { authMiddleware } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import OcrApi20210707, * as $OcrApi20210707 from '@alicloud/ocr-api20210707';
import * as $OpenApi from '@alicloud/openapi-client';

const router = Router();

// 千问 API 配置
const QWEN_API_KEY = process.env.QWEN_API_KEY || '';
const QWEN_API_URL = process.env.QWEN_API_URL || 'https://ws-93mjw4d2mm946w5o.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions';
const QWEN_MODEL = process.env.QWEN_MODEL || 'qwen3.7-plus';

// 阿里云 OCR 配置
const ALIBABA_CLOUD_ACCESS_KEY_ID = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || '';
const ALIBABA_CLOUD_ACCESS_KEY_SECRET = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || '';
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
router.post('/grade', authMiddleware, async (req: AuthRequest, res) => {
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
    const gradingResult = await callQwenVL(image, refAnswer, max_score);

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

  const response = await fetch(QWEN_API_URL, {
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
    return result.words || [];
  } catch {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[1]);
      return result.words || [];
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
2. 找出所有语法错误、拼写错误、标点错误、用词不当、句式问题
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
      "explanation": "错误原因说明"
    }
  ],
  "comments": "总体评语",
  "strengths": ["优点1", "优点2"],
  "improvements": ["改进建议1", "改进建议2"]
}`;

  const response = await fetch(QWEN_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${QWEN_API_KEY}`,
    },
    body: JSON.stringify({
      model: QWEN_MODEL,
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
  });

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
    const base64Data = imageBase64.split(',')[1] || imageBase64;
    const buffer = Buffer.from(base64Data, 'base64');
    
    // 获取图片尺寸
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width || 800;
    const height = metadata.height || 600;

    // 创建 SVG 标注层
    let svgAnnotations = '';
    const color = '#FF0000'; // 红色（像老师用红笔）

    // 如果 OCR 失败，使用位置估算方案
    const useEstimation = ocrWords.length === 0;
    if (useEstimation) {
      console.log('使用位置估算方案');
    } else {
      console.log(`使用 OCR 精确位置，共 ${ocrWords.length} 个单词`);
    }

    errors.forEach((error, index) => {
      let x: number, y: number, wordWidth: number, wordHeight: number;
      
      if (useEstimation) {
        // 位置估算方案：根据行号和单词序号计算位置
        const totalLines = 12; // 估计行数
        const padding = 40; // 边距
        const lineHeight = (height - padding * 2) / totalLines;
        const avgWordWidth = 60; // 平均单词宽度
        
        const line = (error as any).line || 1;
        const wordIndex = (error as any).wordIndex || 1;
        
        x = padding + (wordIndex - 1) * avgWordWidth;
        y = padding + (line - 1) * lineHeight;
        wordWidth = avgWordWidth;
        wordHeight = lineHeight * 0.6;
      } else {
        // OCR 方案：在 OCR 结果中查找匹配的单词
        const matchedWord = ocrWords.find(w => 
          w.text.toLowerCase() === error.original.toLowerCase() ||
          w.text.toLowerCase().includes(error.original.toLowerCase()) ||
          error.original.toLowerCase().includes(w.text.toLowerCase())
        );
        
        if (matchedWord) {
          x = matchedWord.x;
          y = matchedWord.y;
          wordWidth = matchedWord.width;
          wordHeight = matchedWord.height;
        } else {
          console.log(`未找到匹配单词: "${error.original}"`);
          return;
        }
      }
      
      // 1. 在错误单词上画删除线（红色横线）
      svgAnnotations += `
        <line x1="${x}" y1="${y + wordHeight / 2}" x2="${x + wordWidth}" y2="${y + wordHeight / 2}" 
              stroke="${color}" stroke-width="2"/>
      `;
      
      // 2. 在错误单词上方画圆圈标记
      const circleX = x + wordWidth / 2;
      const circleY = y - 10;
      svgAnnotations += `
        <circle cx="${circleX}" cy="${circleY}" r="8" fill="none" stroke="${color}" stroke-width="1.5"/>
        <text x="${circleX}" y="${circleY + 3}" font-size="9" fill="${color}" text-anchor="middle" font-weight="bold">
          ${index + 1}
        </text>
      `;
      
      // 3. 在旁边写正确的单词（红色，斜体）
      if (error.correction && error.correction !== error.original) {
        const correctionX = x + wordWidth + 5;
        const correctionY = y - 5;
        svgAnnotations += `
          <text x="${correctionX}" y="${correctionY}" font-size="11" fill="${color}" font-style="italic" font-family="Arial" font-weight="bold">
            ${error.correction}
          </text>
        `;
      }
    });

    // 在图片底部添加标注列表
    const listStartY = height + 10;
    const listHeight = errors.length * 20 + 30;
    
    let listSvg = `
      <rect x="0" y="${height}" width="${width}" height="${listHeight}" fill="#FFF9E6"/>
      <line x1="0" y1="${height}" x2="${width}" y2="${height}" stroke="#FFCC00" stroke-width="2"/>
      <text x="10" y="${listStartY}" font-size="12" fill="#333" font-family="Arial" font-weight="bold">
        批改标注：
      </text>
    `;
    
    errors.forEach((error, index) => {
      const itemY = listStartY + 18 + index * 20;
      listSvg += `
        <text x="10" y="${itemY}" font-size="11" fill="${color}" font-family="Arial">
          ${index + 1}. ${error.original} → ${error.correction}
        </text>
      `;
    });

    // 创建标注图片（原图 + 底部标注列表）
    const svgOverlay = `
      <svg width="${width}" height="${height + listHeight}">
        ${svgAnnotations}
        ${listSvg}
      </svg>
    `;

    // 合并原图和标注
    const annotatedBuffer = await sharp(buffer)
      .extend({
        bottom: listHeight,
        background: { r: 255, g: 249, b: 230, alpha: 1 },
      })
      .composite([
        {
          input: Buffer.from(svgOverlay),
          top: 0,
          left: 0,
        },
      ])
      .jpeg({ quality: 90 })
      .toBuffer();

    return `data:image/jpeg;base64,${annotatedBuffer.toString('base64')}`;
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
router.get('/history', authMiddleware, async (req: AuthRequest, res) => {
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
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
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
