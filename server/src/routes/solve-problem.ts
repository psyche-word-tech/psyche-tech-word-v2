import { Router } from "express";
import multer from "multer";
import { createHash } from "crypto";
import { writeFileSync } from "fs";
import sharp from "sharp";
import { getSupabaseClient } from "../storage/database/supabase-client.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * 计算文本相似度（Levenshtein 距离）
 */
function similarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1.0;
  
  const costs: number[] = [];
  for (let i = 0; i <= shorter.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= longer.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (shorter[i - 1] !== longer[j - 1]) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[longer.length] = lastValue;
  }
  return (longer.length - costs[longer.length]) / longer.length;
}

/**
 * 修复 JSON 字符串中的控制字符问题
 * LLM 返回的 JSON 中字符串值可能包含未转义的换行符、制表符等
 */
function fixJsonControlChars(jsonStr: string): string {
  let result = '';
  let inString = false;
  let escaped = false;
  
  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    
    if (escaped) {
      // 检查是否是合法的 JSON 转义字符
      if (char === '"' || char === '\\' || char === '/' || char === 'b' || char === 'f' || char === 'n' || char === 'r' || char === 't') {
        result += char;
      } else if (char === 'u') {
        // \uXXXX 需要后面跟 4 个十六进制字符
        result += char;
      } else {
        // 非法转义字符（如 \p, \s, \c 等），去掉反斜杠
        result += char;
      }
      escaped = false;
      continue;
    }
    
    if (char === '\\') {
      result += char;
      escaped = true;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }
    
    if (inString) {
      if (char === '\n') {
        result += '\\n';
      } else if (char === '\r') {
        result += '\\r';
      } else if (char === '\t') {
        result += '\\t';
      } else if (char.charCodeAt(0) < 32) {
        result += '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0');
      } else {
        result += char;
      }
    } else {
      result += char;
    }
  }
  
  return result;
}

// 以 b/f/n/r/t 等"与 JSON 合法转义冲突"的字母开头的 LaTeX 命令。
// 如 \frac(\f)、\boxed(\b)、\right(\r)、\text(\t)、\nu(\n)，
// 若不先转义，JSON.parse 会把 \f/\b/\r/\t 当成控制字符而损坏或报错。
const LATEX_ESCAPE_FIX =
  /(?<!\\)\\(boxed|begin|end|big|bigg|bigl|bigr|binom|bar|beta|bmod|frac|dfrac|tfrac|text|times|to|tau|theta|top|right|rho|rangle|rfloor|rightarrow|nu|ne|neq|nabla|notin|sqrt|left|sum|prod|int|lim|infty|cdot|div|pm|mp|le|leq|ge|geq|approx|equiv|sim|propto|alpha|gamma|delta|lambda|mu|pi|sigma|omega|phi|psi|chi|eta|kappa|zeta|iota|upsilon|varepsilon|epsilon|cup|cap|subset|supset|subseteq|supseteq|forall|exists|partial|angle|triangle|circ|degree|hat|vec|overline|underline|displaystyle|quad|qquad|dbinom|langle|lfloor|leftarrow|leftrightarrow|mapsto|perp|cong|emptyset|varnothing|operatorname|mathrm|mathbf|mathit|mathsf|mathcal|mathbb)\b/g;

/**
 * 更激进的 JSON 修复：处理 LaTeX 反斜杠问题
 * LLM 可能在 JSON 字符串中返回未转义的反斜杠（如 \frac）
 */
function fixJsonLaTeX(jsonStr: string): string {
  // 先把已知 LaTeX 命令的反斜杠转义（含与 JSON 转义冲突的 \f/\b/\r/\t 开头命令），
  // 负向后行断言避免把已正确转义的 \\frac 再次转义
  let result = jsonStr.replace(LATEX_ESCAPE_FIX, '\\\\$1');

  // 再修复控制字符
  result = fixJsonControlChars(result);

  // 最后兜底：转义其余未转义的反斜杠（如 \(、\{、\l 等）
  result = result.replace(/(?<=^|[^\\])(?:\\\\)*\\(?!["\\\/bfnrtu])/g, '\\\\');

  return result;
}

/**
 * 截断自愈：模型输出超长被拦腰截断时，JSON 会留下未闭合的字符串/括号。
 * 扫描一遍补上缺失的闭引号和配对的 ]/}，尽量 salvaging 已完整输出的字段。
 */
function closeTruncatedJson(s: string): string {
  let inStr = false;
  let esc = false;
  const stack: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '{' || c === '[') stack.push(c);
    else if (c === '}' || c === ']') stack.pop();
  }
  let out = s;
  if (inStr) out += '"';
  while (stack.length) {
    const t = stack.pop();
    out += t === '{' ? '}' : ']';
  }
  return out;
}

/**
 * 计算图片 hash
 */
function imageHash(buffer: Buffer): string {
  return createHash("sha256").update(new Uint8Array(buffer)).digest("hex");
}

/**
 * 搜题接口 - 接收图片，先查缓存，未命中则调用大模型解析
 * POST /api/v1/solve-problem
 * Body: FormData with 'image' field (image file)
 */
router.post("/", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "请上传图片" });
    }

    const imageBuffer = req.file.buffer;
    const hash = imageHash(imageBuffer);

    const supabase = getSupabaseClient();

    // 1. 先查缓存：通过图片 hash 或文本相似度
    const { data: cachedProblems, error: cacheError } = await supabase
      .from("problems")
      .select("*")
      .eq("image_hash", hash)
      .limit(1);

    if (!cacheError && cachedProblems && cachedProblems.length > 0) {
      const cached = cachedProblems[0];
      // 忽略之前误缓存的失败占位结果，让其重新走大模型解析
      if (!cached.question_text || cached.question_text === "图片内容无法识别") {
        console.log("[SolveProblem] Cache hit is a failed placeholder, ignore");
      } else {
      console.log("[SolveProblem] Cache hit by image hash");
      return res.json({
        questions: [
          {
            subject: cached.subject,
            question: cached.question_text,
            analysis: cached.analysis,
            solution: cached.solution,
            answer: cached.answer,
            tips: cached.tips,
            knowledge_points: cached.knowledge_points || "",
            core_competency: cached.core_competency || "",
            difficulty: cached.difficulty || "",
            from_cache: true,
          }
        ]
      });
      }
    }

    // 2. 缓存未命中，调用大模型解析。
    // 先把图片压缩后再发给千问 VL：原图直发会生成大量视觉 token，
    // 是单次解析耗时（~30s）的头号来源。压缩到 900px 内 + q65 显著提速，识别质量不受影响。
    let imageBase64 = imageBuffer.toString("base64");
    let mimeType = req.file.mimetype;
    try {
      const compressed = await sharp(imageBuffer)
        .resize(900, 900, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 65 })
        .toBuffer();
      imageBase64 = compressed.toString("base64");
      mimeType = "image/jpeg";
      console.log(`[SolveProblem] 图片压缩: ${Math.round(imageBuffer.length / 1024)}KB -> ${Math.round(compressed.length / 1024)}KB`);
    } catch (compressErr) {
      console.warn("[SolveProblem] 图片压缩失败，使用原图:", (compressErr as Error).message);
    }

    // mode=detail 输出详细解析；默认 concise 输出精炼解答（大幅提速，实测约 10 倍）。
    const mode = req.body?.mode === "detail" ? "detail" : "concise";

    const messages = [
      {
        role: "system" as const,
        content: `你是一位专业的题目解析老师。请仔细分析用户提供的题目图片，给出详细的解析。

**重要：图片中可能包含多道题目，请逐一解析所有题目。**

请按以下 JSON 格式返回结果（必须包含所有字段）：
{
  "questions": [
    {
      "subject": "学科（如数学、物理、化学、英语等）",
      "question": "题目内容（文字描述）",
      "answer": "最终答案",
      "analysis": "题目分析（考查知识点、解题思路）",
      "solution": "详细解答过程",
      "tips": "解题技巧或注意事项（可选）",
      "knowledge_points": "考查的知识点（必填，如：函数、三角函数、概率统计等）",
      "core_competency": "考察的学科核心素养（必填，如：数学抽象、逻辑推理、数学建模、直观想象、数学运算、数据分析等）",
      "difficulty": "难度等级（必填，只能是：简单、中等、困难）"
    }
  ]
}

**注意：knowledge_points、core_competency、difficulty 这三个字段是必填的，不能为空！**

**数学公式格式（重要）：question、analysis、solution、answer、tips 中出现的任何数学公式、符号、表达式，都必须用 LaTeX 语法并用美元符号包裹——行内公式用 $...$，独立成行的公式用 $$...$$。例如：$x^2+1=0$、$$\\frac{1}{2}$$、$D(-1)=\\boxed{\\left(0,\\frac{3}{2}\\right)}$。不要输出未被 $ 包裹的裸 LaTeX。**

**输出要求（重要）：solution/analysis 必须"正式、简洁、直达结论"——只保留从题干到最终答案的关键推理步骤与必要的过渡，明确省略非必要的细化推演和冗余代换（例如不必展开"推出 $f(x_2)\\ge f(0)$"这类可跳过的中间论证，不必对每一步不等式、恒等式或中间式逐条证明），正确作答的前提下步骤尽量精炼（5~8 个关键步骤为宜）；语气正式、可直接呈现给学生，确保返回的 JSON 完整、不被截断、可被直接解析。**

**长度硬上限（极其重要）：单题时整个 JSON 输出总长度不得超过 4000 字符；多小题（如 3 个以上小问）也不得超过 6000 字符。多小问证明题每题 solution 只写关键证明思路与结论，用简洁条目，不要展开为论文式长文；sub-question 细化推演（具体不等式放缩、逐条代换代入、重复的同类推理）一律省略或不逐条证明。宁可精简也不可写超长导致截断。**

**答题风格（极其重要）：这是面向学生的严肃数学解答。solution/analysis 必须是严谨、完整、可直接呈现给学生的最终解答——直接给出推理与结论，语气肯定、逻辑连贯。严禁出现任何自我怀疑、自我纠正、口语化思考碎念（如"不对""哦""我写错了""所以不满足？""重新整理"等），严禁出现畏难或方案讨论式措辞（如"不好直接求""直接求比较麻烦""此处不易求出""考虑到计算较繁"等）——需要更换方法时直接肯定地陈述"采用 XX 方法即可"，把方法作为解题步骤确定给出，不要用"不好直接求"这类话铺垫。严禁暴露思考过程或反复改口。若某一步需要分类讨论，直接清晰地列出各类并给出结论，不要犹豫或否定自己。**

**答案与题干一致性（极其重要）：若题目图片中自带参考答案/小结（如"总结：(1)…；(2)(i)…；(2)(ii)…"之类），则 answer 字段必须与该标准答案逐项严格一致（同一数学表达式、同一形式），且 analysis/solution 必须推导出并收敛到这个答案，不得与它冲突；若题目未附答案，则自行正确作答。"answer" 必须把每个小题（(1)/(2)(i)/(2)(ii) 等）的最终结论都写全，不能只写其中一个。analysis（题目分析）与 solution（详细解答过程）都必须给出实质、可读的内容，缺一不可，禁止留空或只写标题。**

如果图片中只有一道题，questions 数组中只有一个元素。
只返回 JSON，不要有其他解释文字。如果图片不清晰或无法识别，请返回：
{
  "error": "图片不清晰或无法识别，请重新上传"
}`
      },
      {
        role: "user" as const,
        content: [
          {
            type: "image_url" as const,
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
            },
          },
          {
            type: "text" as const,
            text: `请解析图片中的所有题目，并严格按照以下 JSON 格式返回（不要使用 markdown 代码块，直接返回 JSON）：

{
  "questions": [
    {
      "subject": "学科",
      "question": "题目内容（包含选项）",
      "answer": "最终答案",
      "analysis": "详细解析过程",
      "solution": "解答步骤",
      "tips": "解题技巧（可选）",
      "knowledge_points": "考查的知识点（必填）",
      "core_competency": "考察的学科核心素养（必填）",
      "difficulty": "难度等级（必填，只能是：简单/中等/困难）"
    }
  ]
}

**重要：knowledge_points、core_competency、difficulty 三个字段必须填写，不能为空！**

**数学公式必须用 LaTeX 并用美元符号包裹：行内用 $...$，独立成行用 $$...$$（如 $x^2+1$、$$\\frac{1}{2}$$），不要输出裸 LaTeX。**

**解答必须是严谨、肯定、可直接给学生的最终版本，禁止"不对/哦/我写错了/重新整理"等自我纠正或思考碎念，禁止"不好直接求"等畏难、方案讨论式措辞（需要换方法直接说"采用 XX 方法"）。若图片自带参考答案/小结，answer 必须与之逐项一致、解析收敛到该答案；且答案必须写全每个小题的最终结论。analysis 与 solution 都必须给出实质内容，不得为空。**

**JSON 格式硬约束（极其重要，必须遵守）**：
1. 直接返回合法 JSON，不要用 markdown 代码块包裹，也不要加任何前后缀文字。
2. 所有字符串值内的换行/分段必须用 "\\\\n" 转义，严禁在 JSON 里出现真实的换行字符；每个键值对、数组元素之间用逗号分隔，引号严格配对。
3. 不要在字符串结束处多加反斜杠或转义引号——只有确实需要在内容里显示引号时才用 "\\\\\\""，且必须与闭合引号区分清楚。
4. 若某字段无内容，用空字符串 ""，不要省略引号或输出 undefined/null。

如果图片中有多道题，请在 questions 数组中包含所有题目。`,
          },
        ],
      },
    ];

    // mode=concise（默认）：用精简提示词 + flash 模型，大幅提速。
    // 实测同题 max+详细=33s，concise+flash=约3~5s。
    if (mode === "concise") {
      messages[0].content = `你是专业的题目解析老师。请分析题目图片，输出精炼解答。

返回合法 JSON（不要 markdown 代码块、不要任何前后缀），schema 固定为：
{
  "questions": [
    {
      "subject": "学科",
      "answer": "最终答案",
      "analysis": "简要解析（2~4句话）",
      "solution": "解题步骤（精炼，只保留关键推理，3~6步）",
      "tips": "解题技巧（可选，一句话）",
      "knowledge_points": "考查知识点（必填）",
      "core_competency": "核心素养（必填）",
      "difficulty": "简单/中等/困难（必填）"
    }
  ]
}

规则：
1. 不要输出题目文本（题干由图片展示），focus 在答案与解析。
2. 所有公式用 LaTeX 并用 $ 包裹（行内 $...$、独立 $$...$$）。
3. 解答严谨肯定，禁止自我纠正/口语化碎念，禁止"不好直接求"式畏难措辞。
4. analysis 与 solution 要有实质内容但务必精炼，不要展开冗余推导；answer 写全每个小题最终结论。
5. 所有字符串内换行必须用 "\\n" 转义，引号严格配对。
6. 图片中有多道题就全部放进 questions。
7. 图片不清晰/无法识别时返回 {"error":"图片不清晰或无法识别，请重新上传"}。`;
      const userContent = messages[1].content as { type: string; image_url: { url: string }; text: string }[];
      const imgPart = userContent.find((p) => p.type === "image_url");
      userContent[0] = imgPart ? imgPart : userContent[0];
      userContent[1] = {
        type: "text",
        text: `请解析图片中的所有题目，直接返回题目 JSON（不要代码块，不要输出题目文本，题干由图片展示）：
{
  "questions": [
    {
      "subject": "学科",
      "answer": "最终答案",
      "analysis": "简要解析（2~4句）",
      "solution": "精炼解题步骤（3~6步）",
      "tips": "一句话技巧（可选）",
      "knowledge_points": "考查知识点（必填）",
      "core_competency": "核心素养（必填）",
      "difficulty": "简单/中等/困难"
    }
  ]
}

所有公式用 LaTeX 加 $ 包裹；解答严谨肯定、禁止自我纠正碎念；answer 写全每小问结论；字符串内换行用 "\\n" 转义。`,
      };
    }

    // 复用作文批改的千问配置，直连千问 VL 模型完成题目识别与解答
    const qwenApiUrl = process.env.QWEN_API_URL
      || 'https://ws-93mjw4d2mm946w5o.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions';
    const qwenApiKey = process.env.QWEN_API_KEY || '';
    // 所有解析模式统一用 max 解题（flash 对高计算量难题不稳定，详见 AGENTS.md）
    // 可用 QWEN_MODEL 环境变量覆盖。
    const qwenModel = (process.env.QWEN_MODEL || 'qwen3.8-max');
    // 输出长度硬上限：防止 max 模型对复杂题输出失控膨胀到接近 token 上限被截断、
    // JSON 损坏无法修复（详见 AGENTS.md）。所有模式统一 6000。
    const maxTokens = 6000;
    const chatUrl = qwenApiUrl.includes('/chat/completions')
      ? qwenApiUrl
      : `${qwenApiUrl.replace(/\/+$/, '')}/chat/completions`;

    console.log(`[SolveProblem] 调用千问 VL 模型: ${qwenModel}, URL: ${chatUrl}, keyLen=${qwenApiKey.length}`);

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000);

    let llmResponse: { content: string };
    try {
      const resp = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${qwenApiKey}`,
        },
        body: JSON.stringify({
          model: qwenModel,
          messages,
          temperature: 0.3,
          enable_thinking: false,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(`千问 API 调用失败: ${resp.status} - ${errorText}`);
      }
      const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
      const content = data.choices?.[0]?.message?.content || '';
      if (!content) {
        throw new Error('千问 API 返回内容为空');
      }
      llmResponse = { content };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('千问 API 调用超时（300秒）');
      }
      throw err;
    }

    console.log(`[SolveProblem] LLM done in ${Date.now() - startTime}ms`);
    console.log(`[SolveProblem] LLM response length: ${llmResponse.content.length}`);
    console.log(`[SolveProblem] LLM response preview:`, llmResponse.content.substring(0, 500));

    let result: any;
    try {
      result = JSON.parse(llmResponse.content);
      
      // 检查 LLM 是否返回了错误
      if (result.error) {
        console.log("[SolveProblem] LLM returned error:", result.error);
        result = {
          questions: [
            {
              subject: "未知",
              question: "图片内容无法识别",
              analysis: result.error,
              solution: "",
              answer: "",
              tips: "建议：确保光线充足、对焦清晰、题目完整",
              knowledge_points: "",
              core_competency: "",
              difficulty: "简单",
            }
          ]
        };
      }
    } catch (parseError) {
      // 尝试从 markdown 代码块中提取 JSON
      const markdownMatch = llmResponse.content.match(/```(?:json)?\s*([\s\S]*?)```/);
      let jsonStr = markdownMatch ? markdownMatch[1].trim() : null;

      // 如果没有 markdown 代码块，尝试直接提取 JSON
      if (!jsonStr) {
        const jsonMatch = llmResponse.content.match(/\{[\s\S]*\}/);
        jsonStr = jsonMatch ? jsonMatch[0] : null;
      }

      if (jsonStr) {
        try {
          result = JSON.parse(jsonStr);
        } catch (e) {
          // 修复 JSON 中的控制字符问题：将字符串值中的实际换行符/制表符转义
          let fixedJson = fixJsonControlChars(jsonStr);
          try {
            result = JSON.parse(fixedJson);
          } catch (e2) {
            console.error("[SolveProblem] JSON parse failed after fixes:", (e2 as Error).message);
            console.error("[SolveProblem] Fixed JSON preview:", fixedJson.substring(0, 500));
            // 尝试修复 LaTeX 反斜杠问题
            let latexFixed = fixJsonLaTeX(jsonStr);
            try {
              writeFileSync("/tmp/solve_raw.json", jsonStr);
              writeFileSync("/tmp/solve_ctrl.json", fixJsonControlChars(jsonStr));
              writeFileSync("/tmp/solve_latex.json", latexFixed);
            } catch {}
            try {
              result = JSON.parse(latexFixed);
            } catch (e3) {
              console.error("[SolveProblem] LaTeX fix also failed:", (e3 as Error).message);
              // 截断自愈：补全未闭合的字符串/括号， salvaging 已完整输出的字段
              try {
                result = JSON.parse(closeTruncatedJson(latexFixed));
                console.log("[SolveProblem] Salvaged truncated JSON OK");
              } catch (eSalvage) {
                console.error("[SolveProblem] Salvage failed:", (eSalvage as Error).message);
              }

              if (!result) {
                // 尝试更激进的修复：移除所有换行符和制表符
                let aggressiveFixed = jsonStr
                  .replace(/\r\n/g, '\\n')
                  .replace(/\n/g, '\\n')
                  .replace(/\r/g, '\\n')
                  .replace(/\t/g, '\\t')
                  .replace(/[\x00-\x1f\x7f-\x9f]/g, '');
                try {
                  result = JSON.parse(aggressiveFixed);
                } catch (e4) {
                  console.error("[SolveProblem] Aggressive fix also failed:", (e4 as Error).message);
                  result = {
                    questions: [
                      {
                        subject: "未知",
                        question: "图片内容无法识别",
                        analysis: "解析失败，可能原因：图片模糊、光线不足、题目不完整",
                        solution: "",
                        answer: "",
                        tips: "建议：1.确保光线充足 2.对焦清晰 3.题目完整 4.避免反光",
                      }
                    ]
                  };
                }
              }
            }
          }
        }
      }
    }

    // 兼容旧格式：如果返回的是单题格式，转换为数组格式
    if (result && result.subject && !result.questions) {
      result = {
        questions: [
          {
            subject: result.subject,
            question: result.question,
            analysis: result.analysis,
            solution: result.solution,
            answer: result.answer,
            tips: result.tips,
          }
        ]
      };
    }

    // 3. 缓存结果到数据库
    if (result.questions && Array.isArray(result.questions)) {
      for (const q of result.questions) {
        // 失败兜底占位结果不入库，避免污染缓存
        if (!q.question || q.question === "图片内容无法识别") continue;
        // 检查是否有相似题目（文本相似度 > 90%）
        const { data: similarProblems } = await supabase
          .from("problems")
          .select("id")
          .ilike("question_text", `%${q.question?.substring(0, 50) || ""}%`)
          .limit(1);

        if (similarProblems && similarProblems.length > 0) {
          const { data: existing } = await supabase
            .from("problems")
            .select("question_text")
            .eq("id", similarProblems[0].id)
            .single();

          if (existing && similarity(existing.question_text, q.question || "") > 0.9) {
            console.log("[SolveProblem] Similar problem found, skipping cache");
            continue;
          }
        }

        // 插入新题目
        await supabase.from("problems").insert({
          question_text: q.question || "",
          subject: q.subject || "未知",
          answer: q.answer || "",
          analysis: q.analysis || "",
          solution: q.solution || "",
          tips: q.tips || "",
          knowledge_points: q.knowledge_points || "",
          core_competency: q.core_competency || "",
          difficulty: q.difficulty || "",
          image_hash: hash,
        });
      }
      console.log(`[SolveProblem] Cached ${result.questions.length} problems`);
    }

    // 标记来源
    if (result.questions) {
      result.questions.forEach((q: any) => {
        q.from_cache = false;
      });
    }

    console.log(`[SolveProblem] Final result questions:`, JSON.stringify(result.questions?.map((q: any) => ({
      subject: q.subject,
      knowledge_points: q.knowledge_points,
      core_competency: q.core_competency,
      difficulty: q.difficulty
    })), null, 2));

    res.json(result);
  } catch (err: any) {
    console.error("[SolveProblem] Error:", err.message);
    res.status(500).json({
      error: "题目解析失败",
      details: err.message,
    });
  }
});

export default router;
