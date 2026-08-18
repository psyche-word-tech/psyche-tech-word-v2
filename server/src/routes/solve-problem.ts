import { Router } from "express";
import multer from "multer";
import { createHash } from "crypto";
import { LLMClient, Config } from "coze-coding-dev-sdk";
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
 * 计算图片 hash
 */
function imageHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
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
      console.log("[SolveProblem] Cache hit by image hash");
      const cached = cachedProblems[0];
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

    // 2. 缓存未命中，调用大模型解析
    const imageBase64 = imageBuffer.toString("base64");
    const mimeType = req.file.mimetype;

    const config = new Config({
      apiKey: process.env.COZE_API_KEY || "",
    });

    const llmClient = new LLMClient(config);

    const messages = [
      {
        role: "system" as const,
        content: `你是一位专业的题目解析老师。请仔细分析用户提供的题目图片，给出详细的解析。

**重要：图片中可能包含多道题目，请逐一解析所有题目。**

请按以下 JSON 格式返回结果：
{
  "questions": [
    {
      "subject": "学科（如数学、物理、化学、英语等）",
      "question": "题目内容（文字描述）",
      "analysis": "题目分析（考查知识点、解题思路）",
      "solution": "详细解答过程",
      "answer": "最终答案",
      "tips": "解题技巧或注意事项（可选）",
      "knowledge_points": "考查的知识点（如：函数、三角函数、概率统计等）",
      "core_competency": "考察的学科核心素养（如：数学抽象、逻辑推理、数学建模、直观想象、数学运算、数据分析等）",
      "difficulty": "难度等级（简单/中等/困难）"
    }
  ]
}

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
      "analysis": "详细解析过程",
      "solution": "解答步骤",
      "answer": "最终答案",
      "tips": "解题技巧（可选）",
      "knowledge_points": "考查的知识点",
      "core_competency": "考察的学科核心素养",
      "difficulty": "难度等级（简单/中等/困难）"
    }
  ]
}

如果图片中有多道题，请在 questions 数组中包含所有题目。`,
          },
        ],
      },
    ];

    const startTime = Date.now();
    const llmResponse = await llmClient.invoke(messages, {
      model: "doubao-seed-2-0-lite-260215",
      temperature: 0.3,
    });

    console.log(`[SolveProblem] LLM done in ${Date.now() - startTime}ms`);
    console.log(`[SolveProblem] LLM response length: ${llmResponse.content.length}`);

    let result: any;
    try {
      result = JSON.parse(llmResponse.content);
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
          // 如果还是解析失败，尝试修复常见的 JSON 问题
          let fixedJson = jsonStr
            .replace(/\\n/g, "\n")
            .replace(/\\t/g, "\t")
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, "\\");
          try {
            result = JSON.parse(fixedJson);
          } catch (e2) {
            console.error("[SolveProblem] JSON parse failed after fixes:", e2.message);
            result = {
              questions: [
                {
                  subject: "未知",
                  question: "无法解析题目内容",
                  analysis: llmResponse.content,
                  solution: "",
                  answer: "",
                }
              ]
            };
          }
        }
      } else {
        console.error("[SolveProblem] No JSON found in response");
        result = {
          questions: [
            {
              subject: "未知",
              question: "无法解析题目内容",
              analysis: llmResponse.content,
              solution: "",
              answer: "",
            }
          ]
        };
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
