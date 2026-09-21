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
 * 从"解析摘要"块中提取结构化字段并回填到题目对象。
 * 模型在完整解答末尾输出：
 *   ====解析摘要====
 *   结论：<最终答案>      点拨：<思路>      素养：<核心素养>      难度：L3
 *   ====摘要结束====
 * 结论只含最终答案（不含推导），点拨作为解题思路，素养/难度进入细目表。
 * 同时把 solution 中的摘要块剥掉，避免学生端重复看到。
 */
function applySummary(q: any): void {
  const src = (q.solution || '') + '\n' + (q.answer || '');
  // 结束标记可能被模型省略，故 "====解析摘要====" … 到文末也算摘要体
  const m = src.match(/====解析摘要====([\s\S]*?)(?:====摘要结束====|$)/);
  if (!m) return;
  const block = m[1] || '';
  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const get = (label: string) => {
    const re = new RegExp(escapeRe(label) + '[:：]\\s*([^\\n]+)');
    const mm = block.match(re);
    return mm ? mm[1].trim() : '';
  };
  const conclusion = get('结论');
  const dianbo = get('点拨');
  const zhishi = get('知识点');
  const suyang = get('素养');
  const diffM = block.match(/难度[:：]\s*L?([1-6])/);
  if (conclusion) q.answer = conclusion;
  if (dianbo) q.analysis = dianbo;
  if (zhishi) q.knowledge_points = zhishi;
  if (suyang) q.core_competency = suyang;
  if (diffM) q.difficulty = `L${diffM[1]}`;
  // 剥掉摘要块，保持 answer/solution 纯净
  const strip = (s: string) => (s || '').replace(/====解析摘要====[\s\S]*?(?:====摘要结束====|$)/, '').trim();
  if (q.solution) q.solution = strip(q.solution);
  if (q.answer) q.answer = strip(q.answer);
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
    // 同一张图可能因历史坏答案累积了多行，必须按 created_at DESC 取最新，
    // 否则 limit(1) 无排序会随机命中不同行，导致"同一题每次答案都不一样"。
    const { data: cachedProblems, error: cacheError } = await supabase
      .from("problems")
      .select("*")
      .eq("image_hash", hash)
      .order("created_at", { ascending: false })
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

    const systemPrompt = `你是专业的题目解析老师。请仔细看图解题，直接给出完整解答。
要求：
1. 逐一解出每个小问（如 (1)、(2)(i)、(2)(ii)），写出最终答案与推导过程，严谨完整、逐步推导、不跳步、结论肯定。
2. 数学公式一律用 LaTeX 并用美元符号包裹：行内用 $...$（如 $\\dfrac{1}{2}$、$\\sqrt{3}$），独立成行用 $$...$$。不要输出未被 $ 包裹的裸公式。

在完整解答写完后，请另起一行输出一块"解析摘要"，严格按以下格式（每行一个字段，字段名与冒号为英文标点恒定）：
====解析摘要====
结论：<仅列出各小问最终答案，例如 (1) …；(2)(i) …；(2)(ii) …；不含推导过程，必须与前面解答计算出的结果一致>
点拨：<2~4 句解题思路要点/关键突破口>
知识点：<该题考查的学科知识点，如函数、三角函数、不等式、解析几何等>
素养：<该题考查的学科核心素养，如数学抽象、逻辑推理、数学建模、直观想象、数学运算等>
难度：L<1到6的一个数字>
====摘要结束====`;
    const userPrompt = `请完整解答图片中的题目，给出每个小问的最终答案与严谨推导过程，并在文末按格式输出"解析摘要"（含结论/点拨/素养/难度）。`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      {
        role: "user" as const,
        content: [
          { type: "image_url" as const, image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          { type: "text" as const, text: userPrompt },
        ],
      },
    ];

    // 复用作文批改的千问配置，直连千问 VL 模型完成题目识别与解答
    const qwenApiUrl = process.env.QWEN_API_URL
      || 'https://ws-93mjw4d2mm946w5o.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions';
    const qwenApiKey = process.env.QWEN_API_KEY || '';
    // 解题模型：flash 在同图实测能给出正确推导（4√3），且结合缓存修复后结果稳定。
    // 详细模式的"答案不稳定"根因是缓存多条错值+无排序，而非模型；缓存已按 created_at 排序、同 hash 覆盖。
    // 可用 QWEN_MODEL 环境变量覆盖切换。
    const qwenModel = (process.env.QWEN_MODEL || 'qwen3.8-flash');
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
          temperature: 0.1,
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

      // 模型直接输出自然语言/LaTeX 解答（非 JSON）时，整体作为解答返回
      if (!jsonStr) {
        const rawText = llmResponse.content.trim();
        if (rawText.length > 0) {
          result = {
            questions: [
              {
                subject: "",
                question: "",
                analysis: "",
                solution: rawText,
                answer: rawText,
                tips: "",
                knowledge_points: "",
                core_competency: "",
                difficulty: "",
              }
            ]
          };
          console.log("[SolveProblem] 使用自然语言解答（非 JSON 兜底）");
        }
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
                  // 模型输出不是 JSON（自然语言/LaTeX 解答）时，整体作为解答返回，
                  // 避免误报"图片内容无法识别"。
                  const rawText = llmResponse.content.trim();
                  if (rawText.length > 0) {
                    result = {
                      questions: [
                        {
                          subject: "",
                          question: "",
                          analysis: "",
                          solution: rawText,
                          answer: rawText,
                          tips: "",
                          knowledge_points: "",
                          core_competency: "",
                          difficulty: "",
                        }
                      ]
                    };
                    console.log("[SolveProblem] 使用自然语言解答（非 JSON 兜底）");
                  } else {
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

        // 同一张图若已有缓存记录，更新覆盖（避免同 hash 累积多条不同答案导致读取不确定性）；
        // 没有才插入新行。
        const { data: byHash } = await supabase
          .from("problems")
          .select("id")
          .eq("image_hash", hash)
          .limit(1);
        const cacheRow = {
          question_text: q.question || "",
          subject: q.subject || "未知",
          answer: q.answer || "",
          analysis: q.analysis || "",
          solution: q.solution || "",
          tips: q.tips || "",
          knowledge_points: q.knowledge_points || "",
          core_competency: q.core_competency || "",
          difficulty: q.difficulty || "",
        };
        if (byHash && byHash.length > 0) {
          await supabase.from("problems").update(cacheRow).eq("image_hash", hash);
          console.log("[SolveProblem] Updated cache row for image_hash");
        } else {
          await supabase.from("problems").insert({ ...cacheRow, image_hash: hash });
          console.log("[SolveProblem] Inserted new cache row");
        }
      }
      console.log(`[SolveProblem] Cached ${result.questions.length} problems`);
    }

    // 提取模型"解析摘要"块：结论→answer、点拨→analysis、素养/难度→细目表，并剥离摘要块
    if (result.questions && Array.isArray(result.questions)) {
      result.questions.forEach((q: any) => applySummary(q));
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
