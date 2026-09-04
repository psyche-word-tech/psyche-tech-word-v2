import { Router } from 'express';
import sharp from 'sharp';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { authMiddleware } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';

const router = Router();

// 千问 API 配置
const QWEN_API_KEY = process.env.QWEN_API_KEY || '';
const QWEN_API_URL = process.env.QWEN_API_URL || 'https://ws-93mjw4d2mm946w5o.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions';
const QWEN_MODEL = process.env.QWEN_MODEL || 'qwen2.5-vl-72b-instruct';

interface ErrorAnnotation {
  type: 'grammar' | 'spelling' | 'punctuation' | 'word_choice' | 'sentence_structure';
  original: string;
  correction: string;
  explanation: string;
  line?: number;
  column?: number;
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
    const { image, reference_answer, max_score = 25 } = req.body;

    if (!image) {
      return res.status(400).json({ success: false, error: '缺少作文图片' });
    }

    if (!reference_answer) {
      return res.status(400).json({ success: false, error: '缺少参考答案' });
    }

    // 调用千问 VL 模型批改作文
    const gradingResult = await callQwenVL(image, reference_answer, max_score);

    // 在原图上标注错误
    const markedImage = await annotateImage(image, gradingResult.errors);

    // 保存到数据库
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('essay_grading_results')
      .insert({
        user_id: userId,
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
  "total_score": 总分,
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
      "line": 行号（可选）,
      "column": 列号（可选）
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
 * 在原图上标注错误
 */
async function annotateImage(imageBase64: string, errors: ErrorAnnotation[]): Promise<string> {
  try {
    const base64Data = imageBase64.split(',')[1] || imageBase64;
    const buffer = Buffer.from(base64Data, 'base64');
    
    // 获取图片尺寸
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width || 800;
    const height = metadata.height || 600;

    // 创建 SVG 标注层
    let svgAnnotations = '';
    const colors = {
      grammar: '#FF0000',      // 红色 - 语法错误
      spelling: '#FF6600',     // 橙色 - 拼写错误
      punctuation: '#9900FF',  // 紫色 - 标点错误
      word_choice: '#0066FF',  // 蓝色 - 用词不当
      sentence_structure: '#009900', // 绿色 - 句式问题
    };

    errors.forEach((error, index) => {
      const color = colors[error.type] || '#FF0000';
      // 在图片右侧添加标注列表
      const y = 30 + index * 25;
      svgAnnotations += `
        <text x="10" y="${y}" font-size="12" fill="${color}" font-family="Arial">
          ${index + 1}. [${getErrorTypeName(error.type)}] ${error.original} → ${error.correction}
        </text>
      `;
    });

    // 创建标注图片
    const svgOverlay = `
      <svg width="${width}" height="${height + errors.length * 25 + 40}">
        <rect width="100%" height="100%" fill="white"/>
        ${svgAnnotations}
      </svg>
    `;

    // 合并原图和标注
    const annotatedBuffer = await sharp(buffer)
      .extend({
        bottom: errors.length * 25 + 40,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .composite([
        {
          input: Buffer.from(svgOverlay),
          top: height,
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
