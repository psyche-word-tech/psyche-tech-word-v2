import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Router } from 'express';
import sharp from 'sharp';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { optionalAuthMiddleware } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import { callPaddleOCR, WordBox } from '../services/paddleocr';

// 加载环境变量 - 使用 process.cwd() 获取当前工作目录
dotenv.config({ path: path.join(process.cwd(), '.env') });

const router = Router();

// 容错修复：千问长文本偶发被截断导致 JSON 尾部不完整（未闭合字符串/数组/对象）
function repairJsonTrailing(raw: string): string {
  let out = raw;
  // 若以未闭合的字符串结尾，先补闭合引号
  let inStr = false, escaped = false;
  for (let i = 0; i < out.length; i++) {
    const c = out[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\') { escaped = true; continue; }
    if (c === '"') inStr = !inStr;
  }
  if (inStr) out += '"';
  // 再按栈补齐未闭合的数组/对象
  const stack: string[] = [];
  inStr = false; escaped = false;
  for (let i = 0; i < out.length; i++) {
    const c = out[i];
    if (inStr) {
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '[' || c === '{') { stack.push(c); continue; }
    if (c === ']') { stack.pop(); continue; }
    if (c === '}') { stack.pop(); continue; }
  }
  while (stack.length) {
    const open = stack.pop();
    out += open === '[' ? ']' : '}';
  }
  return out;
}

// 千问 API 配置（使用函数延迟读取环境变量）
function getQwenApiKey() {
  return process.env.QWEN_API_KEY || '';
}
function getQwenApiUrl() {
  const baseUrl = process.env.QWEN_API_URL || 'https://ws-93mjw4d2mm946w5o.cn-beijing.maas.aliyuncs.com/compatible-mode/v1';
  return baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
}
function getQwenModel() {
  return process.env.QWEN_MODEL || 'qwen3.8-max';
}

// 阿里云 OCR 配置（使用函数延迟读取环境变量）
function getAlibabaCloudAccessKeyId() {
  return process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || '';
}
function getAlibabaCloudAccessKeySecret() {
  return process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || '';
}
const OCR_ENDPOINT = 'ocr-api.cn-hangzhou.aliyuncs.com';
const MAX_PAGES = 3; // 语文作文最多支持 3 页合并成一篇完整作文

/**
 * 压缩图片（减少传输时间）
 */
async function compressImage(imageBase64: string): Promise<string> {
  try {
    console.log('[CompressImage] 开始压缩图片...');
    const base64Data = imageBase64.split(',')[1] || imageBase64;
    const buffer = Buffer.from(base64Data, 'base64');
    console.log('[CompressImage] 原始图片大小:', Math.round(buffer.length / 1024), 'KB');
    
    // 使用 sharp 压缩图片
    const compressedBuffer = await sharp(buffer)
      .resize(900, 900, { fit: 'inside', withoutEnlargement: true }) // 最大宽度 900px
      .jpeg({ quality: 65 }) // JPEG 质量 65%
      .toBuffer();
    
    console.log('[CompressImage] 压缩后图片大小:', Math.round(compressedBuffer.length / 1024), 'KB');
    
    // 转换回 base64
    const compressedBase64 = compressedBuffer.toString('base64');
    const result = `data:image/jpeg;base64,${compressedBase64}`;
    console.log('[CompressImage] 压缩完成，返回压缩后的图片');
    return result;
  } catch (error) {
    console.error('[CompressImage] 图片压缩失败，使用原图:', error);
    return imageBase64; // 压缩失败返回原图
  }
}

interface ErrorAnnotation {
  type: 'grammar' | 'spelling' | 'punctuation' | 'word_choice' | 'sentence_structure';
  errorType: 'missing' | 'wrong' | 'extra' | 'incomplete';
  wordIdx?: number; // OCR 词表中的全局序号（用于精确定位）
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
  transcription?: string;
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
    const { images, image, reference_answer, max_score = 15, subject = 'english' } = req.body;

    // 兼容单图（image）与多张（images[]）入参
    let imageList: string[] = [];
    if (Array.isArray(images) && images.length) imageList = images;
    else if (image) imageList = [image];
    if (!imageList.length) {
      return res.status(400).json({ success: false, error: '缺少作文图片' });
    }
    imageList = imageList.slice(0, MAX_PAGES);

    // 参考答案可选
    const refAnswer = reference_answer || '';
    const ocrLang = subject === 'chinese' ? 'ch' : 'en';

    // 1. 逐页压缩 + OCR，保留每页词表与全局词表（wordIdx 为跨页全局编号，供千问精确定位）
    console.log('开始逐页 OCR，页数=', imageList.length, 'subject=', subject);
    const pages: { compressed: string; words: OCRWord[]; start: number }[] = [];
    const allWords: OCRWord[] = [];
    let globalStart = 0;
    for (let p = 0; p < imageList.length; p++) {
      console.log(`开始压缩第 ${p + 1} 页图片...`);
      const compressedImage = await compressImage(imageList[p]);
      console.log(`第 ${p + 1} 页压缩完成，压缩后:`, Math.round(compressedImage.length / 1024), 'KB');
      const ocrResult = await callPaddleOCR(compressedImage, ocrLang);
      if (!ocrResult.success) {
        throw new Error(`PaddleOCR 调用失败：第${p + 1}页 ${ocrResult.error}`);
      }
      const words = ocrResult.words || [];
      pages.push({ compressed: compressedImage, words, start: globalStart });
      allWords.push(...words);
      globalStart += words.length;
      console.log(`第 ${p + 1} 页 OCR 完成，返回`, words.length, '个词');
    }

    // 2. 拼接各页 OCR 文本为完整作文
    const joinedTranscription = pages
      .map((pg, index) => `【第${index + 1}页】\n${reconstructText(pg.words)}`)
      .join('\n\n');
    const ocrBoard = allWords.map((w, i) => ({ index: i, text: w.text }));

    // 3. 调用千问 VL 模型整体批改（基于拼接文本 + 各页图片）
    console.log('开始调用千问 VL 模型批改作文...');
    const gradingResult = await callQwenVL(imageList, joinedTranscription, refAnswer, max_score, ocrBoard, subject);
    gradingResult.transcription = joinedTranscription; // 以拼接文本为准，前端展示整篇
    console.log('千问 VL 模型批改完成，错误数量:', gradingResult.errors.length);
    try {
      const fs = await import('fs');
      fs.appendFileSync('/tmp/grade-debug.log', '\n[' + new Date().toISOString() + ']\nPAGES:' + imageList.length + '\nERRORS:' + JSON.stringify(gradingResult.errors) + '\n');
    } catch {}

    // 计算总分：按配权对每个分项硬性封顶，且不再强行凑满到 max_score（尊重模型真实总评）
    const scoreKeys = ['content', 'language', 'structure', 'handwriting'] as const;
    const weights = { content: 0.4, language: 0.3, structure: 0.2, handwriting: 0.1 } as const;
    const caps: Record<(typeof scoreKeys)[number], number> = { content: 0, language: 0, structure: 0, handwriting: 0 };
    let capSum = 0;
    for (const k of scoreKeys) { caps[k] = Math.round(max_score * weights[k]); capSum += caps[k]; }
    if (capSum !== max_score) caps[scoreKeys[0]] += max_score - capSum; // 修正每维度舍入误差，使各上限求和恰为 max_score
    for (const k of scoreKeys) gradingResult.scores[k] = Math.max(0, Math.min(caps[k], Math.round(gradingResult.scores[k])));
    gradingResult.total_score = gradingResult.scores.content + gradingResult.scores.language + gradingResult.scores.structure + gradingResult.scores.handwriting;
    gradingResult.max_score = max_score;

    // 4. 多页标注：把全局 wordIdx 分发到对应页，页内各自标注，每页返回一张标记图
    const pageErrors = assignErrorsByPage(gradingResult.errors, pages, allWords);
    const markedImages: string[] = [];
    for (let p = 0; p < pages.length; p++) {
      markedImages.push(await annotateImage(pages[p].compressed, pageErrors[p], pages[p].words));
    }
    console.log('标注完成，共', markedImages.length, '页');

    // 保存到数据库（多页时存 JSON 数组）
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('essay_grading_results')
      .insert({
        user_id: String(userId),
        original_image: JSON.stringify(imageList),
        marked_image: JSON.stringify(markedImages),
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
        marked_image: markedImages[0],
        marked_images: markedImages,
      },
    });
  } catch (error: any) {
    console.error('作文批改失败:', error);
    res.status(500).json({ success: false, error: error.message || '批改失败' });
  }
});

// callAlibabaOCR 已导入自 ../services/aliyun-ocr

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

  const response = await fetch(`${getQwenApiUrl()}/chat/completions`, {
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
    console.log('OCR API 错误响应:', errorText.substring(0, 500));
    throw new Error(`Qwen OCR API 调用失败: ${response.status} - ${errorText}`);
  }

  console.log('OCR API 响应状态:', response.status);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  console.log('OCR API 响应:', JSON.stringify(data).substring(0, 500));

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
async function callQwenVL(images: string[], joinedTranscription: string, referenceAnswer: string, maxScore: number, ocrWords: { index: number; text: string }[] = [], subject: string = 'english'): Promise<GradingResult> {
  const isChinese = subject === 'chinese';
  const ocrBoard = ocrWords.length > 0
    ? `\n\n## OCR 词表（机器识别的手写词，按出现顺序编号，用于定位）
${ocrWords.map(w => `${w.index}. ${w.text}`).join('\n')}

【定位规则——至关重要】
- 图片上每个单词已由 OCR 词表按顺序编号（序号=词表里的数字）。
- 你判断出某个词错了时，要在该 error 里填上 **wordIdx = 该词在 OCR 词表中的序号**（精确数字）。
- 如果你认为 OCR 某处识别错了，仍以"图上真正该修正的那个位置"为准，选一个**最贴近的 OCR 序号**填入 wordIdx。
- 数组 errors 里每个元素必须带 wordIdx（incomplete 整句时填句中第一个字的 OCR 序号）。` : '';

  const roleLine = isChinese
    ? '你是语文教师，请批改这篇汉语作文。批改以汉字原文中的**错别字、病句、标点、用词、表达**为标准。'
    : '你是英语教师，请批改这篇作文。';

  const task = isChinese
    ? `## 要求
1. 识别作文原文（transcription，中文）
2. 找出所有错误：错别字、病句、标点、用词不当、表达不畅
3. 打分（满分${maxScore}分）：内容 40%、语言表达 30%、结构 20%、卷面书写 10%（各维度满分依次为：内容${Math.round(maxScore * 0.4)}、语言${Math.round(maxScore * 0.3)}、结构${Math.round(maxScore * 0.2)}、卷面书写${Math.round(maxScore * 0.1)}，请在各自满分内估分）
4. 给出评语和建议`
    : `## 要求
1. 识别作文原文（transcription）
2. 找出所有错误（语法、拼写、标点、用词、句式）
3. 打分（满分${maxScore}分）：内容 40%、语言 30%、结构 20%、书写 10%（各维度满分依次为：内容${Math.round(maxScore * 0.4)}、语言${Math.round(maxScore * 0.3)}、结构${Math.round(maxScore * 0.2)}、书写${Math.round(maxScore * 0.1)}，请在各自满分内估分）
4. 给出评语和建议`;

  const typeEnum = isChinese
    ? '"spelling"(错别字)/"grammar"(病句/搭配)/"punctuation"(标点)/"word_choice"(用词不当)/"sentence_structure"(表达行文)'
    : '"grammar/spelling/punctuation/word_choice/sentence_structure"';

  const decompose = isChinese
    ? `### 【重要】拆细到词，严禁合并
同一个句子里即使有多个错误，也必须把每个**错字/病词**分别列成独立的 error（每条 error 只对应一个最小错误单元），不要合并成一条大的 incomplete。规则：
1. **优先词语级**：只要错误可通过改/删/增一个词（或一个错别字）修正，就用 wrong/extra/missing，**不要**用 incomplete。
   - 错别字 → 单独一条 wrong，original=错字，correction=正确字
   - 多写了一个词 → 单独一条 extra，original=该词，correction 填空字符串 ""
   - 少了一个词/字 → 单独一条 missing，original=缺失位置之前的那个词，correction=缺失内容
2. **incomplete 仅限**：只有整句语序混乱、逻辑错误、需整句重写时才用，此时 original 给整句、correction 给正确整句。**能局部修正的绝不用 incomplete**。
3. 一条 error 的 original 必须是最小连续片段，不要贪大。同一处错误只报一次。`
    : `### 【重要】拆细到单词，严禁合并
同一个句子里即使有多个错误，也必须**把每个单词错误分别列成独立的 error**（每条 error 只对应一个最小错误单元），不要把它们合并成一条大的 incomplete。规则：
1. **优先单词级**：只要某个错误可以通过加/删/换一个单词修正，就用 extra/missing/wrong，**不要**用 incomplete。
   - 例：'Socialization can enables' 是 'enables' 冗余 → 单独一条 wrong，original='enables'，correction='enable'
   - 例：'meaningless' 应改为 'meaningful' → 单独一条 wrong，original='meaningless'，correction='meaningful'
   - 例：缺了连接词 'as' → 单独一条 missing，original=前一个词，correction='as'
   - 例：多了个词 → 单独一条 extra，original=该词
2. **incomplete 仅限**：只有当一个句子**整体结构无法通过局部加/删/换词修复**（语序混乱、整句逻辑错误、需整句重写）时才用 incomplete，此时 original 才给整句、correction 给整句。**能局部修正的绝不用 incomplete**。
3. 一条 error 的 original 必须是**最小连续片段**（优先精确到 1 个单词），不要贪大。incomplete 也尽量给出确切范围，不要拖到一整个长段。
- 同一处错误只报一次，不要重复列出相同单词`;

  const noteLine = isChinese
    ? `## 注意
- original 必须与 transcription 中的文本完全一致（汉字不能写错）`
    : `## 注意
- original 必须与 transcription 中的文本完全一致
`;

  const prompt = `${roleLine}

## 作文原文（OCR 分页转录，共 ${images.length} 页，已按阅读顺序合并为完整作文）
${joinedTranscription}

> 说明：上面的作文原文是系统 OCR 从${images.length}页图片转录合并的，可能含个别识别误差。你**必须基于这段原文**批改：
> - transcription 字段**原样返回**上面这段原文，不要改写、不要重组；
> - errors 里的 original 必须从这段原文中取样，与原文逐字完全一致；
> - 结合各页图片可辅助判断书写/卷面，但错别字、病句、标点等**以这段原文为准**。

## 参考答案
${referenceAnswer || '无'}

${task}

## 输出格式（JSON）
{"transcription":"原文","max_score":${maxScore},"scores":{"content":0,"language":0,"structure":0,"handwriting":0},"errors":[{"type":"${typeEnum}","errorType":"missing/wrong/extra/incomplete","wordIdx":0,"original":"错误原文","correction":"正确写法","explanation":"说明"}],"comments":"评语","strengths":[],"improvements":[]}

## errorType（决定批改标记类型，务必准确）
- extra: 多了一个词（可直接删掉）。original=多余的那个词，correction 填空字符串 ""
- missing: 少了一个词（需插入）。**original=缺失位置之前紧邻的那个单词**（用于标记插入点），correction=缺失的内容
- wrong: 改一个词/字。original=错误写法，correction=正确写法
- incomplete: 句子错误/不完整/整体表达不佳（需改写整句或整段）。original=出错的完整句子片段或短语，correction=正确的完整句子
${ocrBoard}

${decompose}

${noteLine}

## 严格输出要求（必须遵守）
你只能输出一个合法的 JSON 对象，禁止输出任何解释、前言、思考过程、批注说明或 markdown 代码块，禁止在 JSON 外附加任何文字。所有批改结论都必须放进上方 JSON 结构的对应字段里。
`;

  console.log('调用千问 VL 模型，API URL:', getQwenApiUrl());
  console.log('模型:', getQwenModel());
  console.log('API Key 长度:', getQwenApiKey().length);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000); // 300 秒超时（qwen3.8-max 旗舰模型较慢）

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
              ...images.flatMap((img, i) => [
                { type: 'text', text: `（第${i + 1}页图片）` },
                {
                  type: 'image_url',
                  image_url: {
                    url: img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`,
                  },
                },
              ]),
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 2560,
        enable_thinking: false,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('千问 API 调用超时（150秒）');
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
  // 写入文件日志（无论如何解析都记录）
  const fs = await import('fs');
  try {
    fs.writeFileSync('/tmp/qwen-raw.log', content);
  } catch {}
  try {
    // 尝试直接解析
    gradingResult = JSON.parse(content);
    fs.writeFileSync('/tmp/qwen-response.log', JSON.stringify(gradingResult, null, 2));
    console.log('千问 VL 模型响应已写入 /tmp/qwen-response.log');
  } catch {
    // 依次尝试：markdown 代码块提取 → 花括号对象 → 截断补全修复
    const candidates = (() => {
      const arr: string[] = [];
      const fenced = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (fenced) arr.push(fenced[1]);
      const obj = content.match(/\{[\s\S]*\}/);
      if (obj) arr.push(obj[0]);
      arr.push(repairJsonTrailing(content));
      arr.push((() => {
        const i = content.lastIndexOf(']');
        if (i < 0) return content;
        return content.slice(0, i + 1) + '}';
      })());
      return arr;
    })();
    let parsed = false;
    for (const cand of candidates) {
      try {
        gradingResult = JSON.parse(cand);
        parsed = true;
        break;
      } catch {}
    }
    if (!parsed) {
      throw new Error('无法解析千问 API 返回的 JSON');
    }
    console.log('千问 JSON 通过容错修复后解析成功');
    try {
      fs.writeFileSync('/tmp/qwen-response.log', JSON.stringify(gradingResult, null, 2));
    } catch {}
  }

  return gradingResult;
}

/**
 * 在 OCR 结果中查找匹配的文字块
 */
// 按阅读顺序把一页的词表重建为文本（行内按 x 排序、行间换行，兼容词级/行级框）
function reconstructText(words: OCRWord[]): string {
  if (!words.length) return '';
  const rows: Record<number, { x: number; text: string }[]> = {};
  for (const w of words) {
    const key = Math.round((w.y + (w.height || 0) / 2) / 12);
    if (!rows[key]) rows[key] = [];
    rows[key].push({ x: w.x, text: w.text });
  }
  return Object.keys(rows)
    .map(Number)
    .sort((a, b) => a - b)
    .map((k) => rows[k].slice().sort((a, b) => a.x - b.x).map(r => r.text).join(' '))
    .join('\n');
}

// 把千问返回的（全局 wordIdx）错误分发到对应页，并把 wordIdx 改写为页内序号；无法用序号定位的用文本匹配兜底
function assignErrorsByPage(
  errors: ErrorAnnotation[],
  pages: { start: number; words: OCRWord[] }[],
  _allWords: OCRWord[],
): ErrorAnnotation[][] {
  const result = pages.map(() => [] as ErrorAnnotation[]);
  for (const e of errors) {
    let target: number | null = null;
    const widx = (e as unknown as { wordIdx?: number }).wordIdx;
    if (typeof widx === 'number' && widx >= 0) {
      for (let p = 0; p < pages.length; p++) {
        if (widx >= pages[p].start && widx < pages[p].start + pages[p].words.length) {
          target = p;
          break;
        }
      }
      if (target != null) {
        result[target].push({ ...e, wordIdx: widx - pages[target].start });
        continue;
      }
    }
    let matched = false;
    for (let p = 0; p < pages.length; p++) {
      if (findMatchingOCRWord(e.original || '', pages[p].words)) {
        result[p].push({ ...e, wordIdx: undefined });
        matched = true;
        break;
      }
    }
    if (!matched) result[0].push({ ...e, wordIdx: undefined });
  }
  return result;
}

function findMatchingOCRWord(errorText: string, ocrWords: OCRWord[]): OCRWord | null {
  if (!errorText || ocrWords.length === 0) return null;
  
  // 清理错误文本（去除标点、转小写、压缩空格）
  const clean = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').trim().replace(/\s+/g, ' ');
  const cleanError = clean(errorText);
  
  // 1. 精确匹配（整段）
  for (const word of ocrWords) {
    if (clean(word.text) === cleanError) return word;
  }
  
  // 2. 词级精确匹配（错误文本拆成单词，与 OCR 单词逐一匹配，取最长优先）
  const errorWords = cleanError.split(/\s+/).filter(w => w.length >= 2);
  if (errorWords.length > 0) {
    // 优先匹配词表中的长词，避免单字母误命中
    const sortedErrorWords = [...errorWords].sort((a, b) => b.length - a.length);
    for (const ew of sortedErrorWords) {
      for (const word of ocrWords) {
        if (clean(word.text) === ew) return word;
      }
    }
  }
  
  // 3. 模糊包含匹配（仅较长单词，避免 "a" 误命中）
  for (const word of ocrWords) {
    const cw = clean(word.text);
    if (cw.length < 3) continue;
    if (cleanError.includes(cw) || cw.includes(cleanError)) return word;
  }
  
  return null;
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
    let width = metadata.width || 800;
    let height = metadata.height || 600;

    // 先压缩图片（如果太大）
    let processedBuffer = buffer;
    let coordScale = 1;
    if (width > 1080 || height > 1920) {
      console.log('[annotateImage] 图片较大，先压缩...');
      coordScale = Math.min(1080 / width, 1920 / height);
      width = Math.floor(width * coordScale);
      height = Math.floor(height * coordScale);
      console.log('[annotateImage] 开始压缩...');
      processedBuffer = await sharp(buffer).resize(width, height).toBuffer();
      console.log('[annotateImage] 压缩完成:', width, 'x', height);
    }

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

    const seenOriginals = new Set<string>();
    let seqNo = 0;
    errors.forEach((error, index) => {
      // 同一单词只标注一次（模型可能把同一词在多个位置判错，避免重复标注）
      const normKey = String(error && error.original ? error.original : '').toLowerCase().replace(/\s+/g, '');
      if (normKey && seenOriginals.has(normKey)) {
        console.log(`[annotateImage] 跳过重复错误词：${error.original}`);
        return;
      }
      if (normKey) seenOriginals.add(normKey);

      // 跳过纯标点/无实质词的"错误"（如逗号→句号），避免噪音标注
      const origTrim = String(error.original || '').trim();
      if (origTrim && !/[A-Za-z\u4e00-\u9fa5]/.test(origTrim)) {
        console.log(`[annotateImage] 跳过标点错误：${error.original}`);
        return;
      }

      seqNo += 1;

      // 优先使用 OCR 数据匹配位置
      let x = 0, y = 0, wordWidth = 50 * scale, wordHeight = 30 * scale;
      let foundInOCR = false;
      
      // 在 OCR 结果中查找匹配的文字块（需要缩放坐标）
      if (ocrWords.length > 0) {
        // wordIdx 优先：千问引用 OCR 词表序号精确定位（文本不再匹配，位置必然对上）
        const widx = (error as any).wordIdx;
        if (typeof widx === 'number' && widx >= 0 && widx < ocrWords.length) {
          const w = ocrWords[widx];
          x = w.x * coordScale;
          y = w.y * coordScale;
          wordWidth = w.width * coordScale;
          wordHeight = w.height * coordScale;
          foundInOCR = true;
          console.log(`[annotateImage] 使用 wordIdx=${widx} 定位：${error.original} -> "${w.text}" at (${x}, ${y}, ${wordWidth}, ${wordHeight})`);
        } else {
          const matchedWord = findMatchingOCRWord(error.original, ocrWords);
          if (matchedWord) {
            x = matchedWord.x * coordScale;
            y = matchedWord.y * coordScale;
            wordWidth = matchedWord.width * coordScale;
            wordHeight = matchedWord.height * coordScale;
            foundInOCR = true;
            console.log(`[annotateImage] OCR 匹配成功：${error.original} at (${x}, ${y}, ${wordWidth}, ${wordHeight})`);
          }
        }
      }
      
      // 如果 OCR 没找到，尝试使用千问 VL 模型返回的 bbox（需要缩放坐标）
      if (!foundInOCR && (error as any).bbox && Array.isArray((error as any).bbox) && (error as any).bbox.length === 4) {
        const [bx1, by1, bx2, by2] = (error as any).bbox;
        // 判断是 [x1, y1, x2, y2] 还是 [x, y, width, height] 格式
        if (bx2 > bx1 && by2 > by1 && bx2 - bx1 < 1000 && by2 - by1 < 1000) {
          // [x1, y1, x2, y2] 格式
          x = bx1;
          y = by1;
          wordWidth = bx2 - bx1;
          wordHeight = by2 - by1;
        } else {
          // [x, y, width, height] 格式
          x = bx1;
          y = by1;
          wordWidth = bx2;
          wordHeight = by2;
        }
        
        // 如果 bbox 在键盘区域（y < 1500），自动调整到作文纸区域
        if (y < 1500) {
          const adjustment = 1500 - y;
          y = y + adjustment;
          console.log(`[annotateImage] bbox 在键盘区域，自动调整 y: ${y - adjustment} -> ${y}`);
        }
        
        console.log(`[annotateImage] 使用 bbox 位置：${error.original} at (${x}, ${y}, ${wordWidth}, ${wordHeight})`);
      }
      
      // 如果都没找到，使用位置估算
      if (!foundInOCR && !(error as any).bbox) {
        const avgWordWidth = 50 * scale;
        const line = (error as any).line || 1;
        const wordIndex = (error as any).wordIndex || 1;
        
        x = paddingLeft + (wordIndex - 1) * avgWordWidth;
        y = paddingTop + (line - 1) * lineHeight;
        wordWidth = avgWordWidth;
        wordHeight = lineHeight * 0.5;
        console.log(`[annotateImage] 使用估算位置：${error.original} at line ${line}, word ${wordIndex}`);
      }
      
      // —— 圆圈数字（所有类型统一，放词左上方，防溢出）——
      const margin = 8 * scale;
      const et = String((error as any).errorType || 'wrong');
      // 句子级：errorType 为 incomplete，或 type 为 sentence_structure，或 original 为多词短语
      const isSentence = et === 'incomplete' || error.type === 'sentence_structure' || String(error.original || '').split(/\s+/).length > 3;
      const circleFontSize = Math.max(12, lineHeight * 0.2);

      let circleCX = x;
      let circleCY = y - 18 * scale;
      const circleR = Math.max(9, 12 * scale);
      if (circleCY < circleR) circleCY = y + wordHeight + 18 * scale; // 顶部越界 → 移到词下方
      if (circleCX < circleR) circleCX = x + wordWidth + 20 * scale;  // 左侧越界 → 移到词右侧
      svgAnnotations += `
        <circle cx="${circleCX}" cy="${circleCY}" r="${circleR}" fill="none" stroke="${color}" stroke-width="${2 * scale}"/>
        <text x="${circleCX}" y="${circleCY + 5 * scale}" font-size="${circleFontSize}" fill="${color}" text-anchor="middle" font-weight="bold">
          ${seqNo}
        </text>
      `;

      if (et === 'extra') {
        // 1. 多一个单词 → 红色横线直接穿过该单词（删除线）
        const strikeY = y + wordHeight / 2;
        svgAnnotations += `
          <line x1="${x}" y1="${strikeY}" x2="${x + wordWidth}" y2="${strikeY}" stroke="${color}" stroke-width="${3 * scale}"/>
        `;
      } else if (et === 'missing') {
        // 2. 少一个单词 → 在 original（前一个词）右侧画插入符 ∧，把缺少的词写在插入符上方
        // 插入符画在词的垂直中线高度（而非词底部），避免落到下一行视觉位置
        const ax = x + wordWidth + margin;
        const ayBase = y + wordHeight * 0.55;
        const ins = Math.max(8, 7 * scale);
        svgAnnotations += `
          <path d="M ${ax} ${ayBase + 3 * scale} L ${ax - ins} ${ayBase - 10 * scale} M ${ax} ${ayBase + 3 * scale} L ${ax + ins} ${ayBase - 10 * scale}" stroke="${color}" stroke-width="${2.5 * scale}" fill="none"/>
        `;
        // 缺失词只取 correction 中真正需要插入的那个词（千问可能返回 "studying as" 这类含原文词的双词）
        const _parts = String(error.correction || '').trim().split(/\s+/).filter(Boolean);
        const insText = _parts.length > 1 ? _parts[_parts.length - 1] : (error.correction || '');
        if (insText) {
          const cfon = Math.max(10, lineHeight * 0.15);
          const iw = estimateTextWidth(insText, cfon);
          let ix = ax;
          let iy = y - 12 * scale;
          if (ix + iw > width - margin) ix = width - margin - iw;
          if (ix < margin) ix = margin;
          if (iy < 12) iy = y + wordHeight + cfon + 6 * scale;
          svgAnnotations += `
            <text x="${ix}" y="${iy}" font-size="${cfon}" fill="${color}" font-style="italic" font-family="DejaVu Sans, WenQuanYi Micro Hei">${insText}</text>
          `;
        }
      } else if (isSentence) {
        // 4. 句子错误 → 框出整个句子，正确句子写在框下方
        const phrase = locatePhrase(String(error.original || ''), ocrWords);
        if (phrase && phrase.x !== undefined) {
          const px = phrase.x * coordScale, py = phrase.y * coordScale;
          const pw = phrase.width * coordScale, ph = phrase.height * coordScale;
          svgAnnotations += `
            <rect x="${px - 3 * scale}" y="${py - 3 * scale}" width="${pw + 6 * scale}" height="${ph + 6 * scale}" fill="none" stroke="${color}" stroke-width="${2.5 * scale}"/>
          `;
          if (error.correction) {
            const cfon = Math.max(10, lineHeight * 0.15);
            const cw = estimateTextWidth(error.correction, cfon);
            let cxp = px;
            if (cxp + cw > width - margin) cxp = width - margin - cw;
            if (cxp < margin) cxp = margin;
            const cyp = py + ph + 18 * scale;
            svgAnnotations += `
              <text x="${cxp}" y="${cyp}" font-size="${cfon}" fill="${color}" font-style="italic" font-family="DejaVu Sans, WenQuanYi Micro Hei">${error.correction}</text>
            `;
          }
        }
      } else {
        // 3. 改一个单词 → 单词下面画下划线，正确单词写在线下方
        // 下划线自适应定位：默认贴本词框底部；若紧邻下方有水平交叠的文字（下一行词），
// 则收线到该下方词的上沿之上留 6px，避免线穿到下一行。随每个词的布局自动调整。
        const bottomPix = y + wordHeight;
        let collideTop = bottomPix;
        for (const w of ocrWords) {
          if (w.y > y && w.y < y + wordHeight + 24 && w.x < x + wordWidth && w.x + w.width > x) {
            if (w.y < collideTop) collideTop = w.y;
          }
        }
        const ulY = collideTop < bottomPix ? Math.max(y + wordHeight * 0.4, collideTop - 6) : bottomPix;
        svgAnnotations += `
          <line x1="${x}" y1="${ulY}" x2="${x + wordWidth}" y2="${ulY}" stroke="${color}" stroke-width="${3 * scale}"/>
        `;
        if (error.correction && error.correction !== error.original) {
          const cfon = Math.max(10, lineHeight * 0.15);
          const cw = estimateTextWidth(error.correction, cfon);
          let cxp = x;
          let cyp = ulY + cfon * 0.6;
          if (cxp + cw > width - margin) cxp = width - margin - cw;
          if (cxp < margin) cxp = margin;
          // 订正文字
          svgAnnotations += `
            <text x="${cxp}" y="${cyp}" font-size="${cfon}" fill="${color}" font-style="italic" font-family="DejaVu Sans, WenQuanYi Micro Hei">${error.correction}</text>
          `;
        }
      }
    });

    // 在图片底部添加标注列表（进一步增大字体），长文本自动换行
    const margin2 = 40;
    const listLineH = 38;
    const listItemFont = 24;
    const listMaxW = width - margin2;
    const wrappedRows: string[][] = [];
    let totalListH = 64; // 标题区占位
    let itemCounter = 0;
    errors.forEach((error) => {
      const et = String((error as any).errorType || 'wrong');
      let label: string;
      if (et === 'extra') label = `[删] ${error.original || ''}`;
      else if (et === 'missing') label = error.correction ? `[加] 在「${error.original || ''}」后加: ${error.correction}` : `[加] ${error.original || ''}`;
      else if (et === 'incomplete' || error.type === 'sentence_structure') label = `[句] ${error.original || ''} → ${error.correction || ''}`;
      else label = `[改] ${error.original || ''} → ${error.correction || ''}`;
      const rows = wrapText(`${itemCounter + 1}. ${label}`, listItemFont, listMaxW);
      wrappedRows.push(rows);
      totalListH += rows.length * listLineH + 6;
      itemCounter++;
    });
    const listHeight = totalListH;
    const listStartY = height + 30;

    let listSvg = `
      <rect x="0" y="${height}" width="${width}" height="${listHeight}" fill="#FFF9E6"/>
      <line x1="0" y1="${height}" x2="${width}" y2="${height}" stroke="#FFCC00" stroke-width="4"/>
      <text x="20" y="${listStartY}" font-size="28" fill="#333" font-family="DejaVu Sans, WenQuanYi Micro Hei" font-weight="bold">
        批改标注：
      </text>
    `;
    let listCursorY = listStartY + 44;
    wrappedRows.forEach((rows) => {
      for (const ln of rows) {
        listSvg += `
          <text x="20" y="${listCursorY}" font-size="${listItemFont}" fill="${color}" font-family="DejaVu Sans, WenQuanYi Micro Hei" font-weight="bold">${ln}</text>
        `;
        listCursorY += listLineH;
      }
      listCursorY += 6;
    });

    // 使用 sharp 的 extend + composite 方法
    console.log('使用 sharp 生成标注图片...');
    
    // 1. 扩展原图高度（底部添加黄色背景）
    const extendedBuffer = await sharp(processedBuffer)
      .extend({
        bottom: listHeight,
        background: { r: 255, g: 249, b: 230, alpha: 1 }
      })
      .toBuffer();
    
    // 调试：叠加所有 OCR 词框（黄框 + 序号），用于核对词框与字迹的对齐
    const debugBoxes = ocrWords.map((w, i) => `
      <rect x="${w.x}" y="${w.y}" width="${w.width}" height="${w.height}"
        fill="none" stroke="#FACC15" stroke-width="2" />
      <text x="${w.x + 2}" y="${w.y - 4}" font-family="DejaVu Sans" font-size="13"
        fill="#FACC15">${i}</text>
    `).join('');

    // 2. 创建 SVG 标注层（只包含标注，不包含原图）
    const svgOverlay = `
      <svg width="${width}" height="${height + listHeight}">
        ${debugBoxes}
        ${svgAnnotations}
        ${listSvg}
      </svg>
    `;
    
    // 3. 将 SVG 标注层叠加到扩展后的原图上
    console.log('[annotateImage] 开始叠加 SVG 标注层...');
    const annotatedBuffer = await sharp(extendedBuffer)
      .composite([{
        input: Buffer.from(svgOverlay),
        top: 0,
        left: 0
      }])
      .png()
      .toBuffer();
    console.log('[annotateImage] SVG 标注层叠加完成');
    
    return `data:image/png;base64,${annotatedBuffer.toString('base64')}`;
  } catch (error) {
    console.error('图片标注失败:', error);
    return imageBase64; // 标注失败返回原图
  }
}

// 按短语定位 OCR 中的近似区域（用于句子级标注）
function locatePhrase(text: string, ocrWords: OCRWord[]): OCRWord | null {
  if (!text) return null;
  const whole = findMatchingOCRWord(text, ocrWords);
  if (whole) return whole;
  const words = text.split(/\s+/).filter((w: string) => w.length >= 2);
  const hits: OCRWord[] = [];
  for (const w of words) {
    const m = findMatchingOCRWord(w, ocrWords);
    if (m && m.x !== undefined) hits.push(m);
  }
  if (!hits.length) return null;
  const minX = Math.min(...hits.map(h => h.x));
  const minY = Math.min(...hits.map(h => h.y));
  const maxX = Math.max(...hits.map(h => h.x + h.width));
  const maxY = Math.max(...hits.map(h => h.y + h.height));
  return { text, x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function estimateTextWidth(text: string, fontSize: number): number {
  let w = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) || 0;
    if (code >= 0x4e00 && code <= 0x9fff) w += fontSize;        // 中文全角
    else if (/[A-Za-z]/.test(ch)) w += fontSize * 0.62;          // 英文字母
    else if (/[0-9]/.test(ch)) w += fontSize * 0.52;             // 数字
    else if (ch === ' ') w += fontSize * 0.35;
    else w += fontSize * 0.45;                                    // 标点
  }
  return w;
}

function wrapText(text: string, fontSize: number, maxWidth: number): string[] {
  if (!text) return [];
  const lines: string[] = [];
  let current = '';
  for (const ch of text) {
    const test = current + ch;
    if (estimateTextWidth(test, fontSize) <= maxWidth) {
      current = test;
    } else {
      if (current.trim()) {
        const trimmed = current.trim();
        lines.push(trimmed.slice(0, 1).toUpperCase() + trimmed.slice(1));
      }
      current = ch;
    }
  }
  if (current.trim()) {
    const trimmed = current.trim();
    lines.push(trimmed.slice(0, 1).toUpperCase() + trimmed.slice(1));
  }
  return lines.length ? lines : [text];
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
