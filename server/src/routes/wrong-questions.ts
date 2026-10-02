import { Router } from "express";
import multer from "multer";
import { createRequire } from "module";
import sharp from "sharp";
import { getSupabaseClient } from "../storage/database/supabase-client.js";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";

const require = createRequire(import.meta.url);

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function isImageMime(mime: string): boolean {
  return /^image\//.test(mime || "");
}

type QStatus = "wrong" | "attention" | "correct" | "blank";

interface ParsedQuestion {
  number: string;
  question: string;
  user_answer: string;
  correct_answer: string;
  status: QStatus;
  reason: string;
  knowledge_point: string;
  core_competency: string;
  difficulty: string;
}

interface Recognized {
  subject: string;
  questions: ParsedQuestion[];
}

/**
 * 从 PDF / Word 文档提取纯文本
 */
async function parseDocText(buffer: Buffer, mime: string, filename?: string): Promise<string | null> {
  const name = (filename || "").toLowerCase();
  try {
    if (mime === "application/pdf" || name.endsWith(".pdf")) {
      const { PDFParse } = require("pdf-parse") as { PDFParse: new (opt: { data: Buffer }) => { getText(): Promise<{ text: string }> } };
      const parser = new PDFParse({ data: buffer });
      const out = await parser.getText();
      const text = (out?.text || "").trim();
      return text ? `[PDF 内容]\n${text}` : null;
    }
    if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || name.endsWith(".docx")) {
      const mammoth = require("mammoth") as { extractRawText(opts: { buffer: Buffer }): Promise<{ value: string }> };
      const out = await mammoth.extractRawText({ buffer });
      const text = (out?.value || "").trim();
      return text ? `[Word 内容]\n${text}` : null;
    }
    return null;
  } catch (e) {
    console.warn("[WrongQuestions] 文档解析失败:", (e as Error).message);
    return null;
  }
}

/**
 * 逐题识别：学科 + 每题对错状态。
 * 判对错规则（写入 prompt）：
 *  - 有批改痕迹：题号/答案处画 ×/叉 → wrong；题号被圈/框（重点关注）→ attention；画 ✓/勾 → correct
 *  - 无批改痕迹但用户写了答案：模型先独立解题，再与用户答案核对 → correct/wrong
 *  - 用户未作答且无痕迹 → blank
 */
async function recognizeContent(content: {
  images: { base64: string; mime: string }[];
  texts: string[];
}): Promise<Recognized | null> {
  const qwenApiUrl = (process.env.QWEN_API_URL || 'https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1').replace(/\/+$/, '');
  const chatUrl = `${qwenApiUrl}/chat/completions`;
  const apiKey = process.env.QWEN_API_KEY || '';
  const model = process.env.QWEN_MODEL || 'qwen3.8-flash';

  const messages: any[] = [
    {
      role: "system",
      content:
        "你是经验丰富的批改与题目分析老师。用户上传题目/试卷照片（可能含用户手写答案与批改痕迹）。任务：\n" +
        "1. 判定学科。\n" +
        "2. 逐题识别：题号、完整题干（含小题与选项）、用户手写答案（没有则空串）。语法填空/完形类带空的题，必须额外返回 raw_context 字段：该空所在段落/小节的完整原文（从段落开头抄到段落结尾，空位用 ____ 标出），服务端会据此自动截取上下文三句。\n" +
        "3. 判定每题 status：\n" +
        "   - 有批改痕迹时：题号或答案处画了 ×、叉、打叉 → \"wrong\"；题号被圈起来/框起来（代表重点关注）→ \"attention\"；画了 ✓、勾、对号 → \"correct\"。\n" +
        "   - 没有批改痕迹但用户写了答案时：你必须先自己独立解出该题正确答案，再与用户答案核对：一致 → \"correct\"，不一致 → \"wrong\"，并在 reason 写清用户错在哪里、correct_answer 写正确答案。\n" +
        "   - 用户没写答案也无痕迹 → \"blank\"。\n" +
        "4. wrong/attention 题给 reason（错因/要点）与 knowledge_point（知识点）；correct 题 reason 可空。\n" +
        "5. 每题给 core_competency（学科核心素养，简短，如 语言能力/思维品质/文化意识/学习能力/数学运算/逻辑推理/直观想象 等）与 difficulty（难度，L1-L6，L1 最易 L6 最难）。\n" +
        "只返回合法 JSON（不要 markdown 代码块），schema：" +
        `{"subject":"学科（如 数学/语文/英语/物理/化学/生物/政治/历史/地理）","questions":[{"number":"题号","question":"题干","user_answer":"用户手写答案","correct_answer":"正确答案","status":"wrong|attention|correct|blank","reason":"错因或要点","knowledge_point":"知识点","core_competency":"核心素养","difficulty":"L1-L6","raw_context":"语法填空/完形题该空所在段落完整原文(空位用____标出)，非此类题填空串"}]}`,
    },
  ];
  const userContent: any[] = [];
  for (const img of content.images) {
    userContent.push({ type: "image_url", image_url: { url: `data:${img.mime};base64,${img.base64}` } });
  }
  if (content.texts.length > 0) {
    userContent.push({ type: "text", text: content.texts.join("\n\n") });
  }
  messages.push({ role: "user", content: userContent });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const resp = await fetch(chatUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, temperature: 0.2, enable_thinking: false, max_tokens: 6000 }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`千问 API 调用失败: ${resp.status} - ${t.slice(0, 200)}`);
    }
    const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
    const contentStr = data.choices?.[0]?.message?.content || "";
    if (!contentStr) throw new Error("千问 API 返回内容为空");
    const parsed = extractJson(contentStr);
    if (!parsed) return null;
    const rawQs = Array.isArray(parsed.questions) ? parsed.questions : [];
    const questions: ParsedQuestion[] = rawQs
      .filter((q: any) => q && typeof q === "object")
      .map((q: any) => {
        const nq = normalizeQuestion(q);
        const three = extractThreeSentences(String(q.raw_context || ""));
        if (three) nq.question = three;
        return nq;
      })
      .filter((q: ParsedQuestion) => q.question || q.user_answer || q.number);
    if (questions.length === 0) return null;
    return { subject: String(parsed.subject || "未知"), questions };
  } finally {
    clearTimeout(timer);
  }
}

function extractJson(contentStr: string): any {
  const cleaned = contentStr.replace(/```json|```/g, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first < 0 || last <= first) return null;
  let jsonStr = cleaned.slice(first, last + 1);
  try {
    return JSON.parse(jsonStr);
  } catch {
    // 截断/尾逗号自愈：去尾逗号后补未闭合括号
    jsonStr = jsonStr.replace(/,\s*([}\]])/g, "$1");
    try {
      return JSON.parse(jsonStr);
    } catch {
      const openB = (jsonStr.match(/{/g) || []).length;
      const closeB = (jsonStr.match(/}/g) || []).length;
      const openS = (jsonStr.match(/\[/g) || []).length;
      const closeS = (jsonStr.match(/]/g) || []).length;
      let fixed = jsonStr;
      if (/"[^"]*$/.test(fixed)) fixed += '"';
      fixed = fixed.replace(/,\s*$/, "");
      fixed += "]".repeat(Math.max(0, openS - closeS));
      fixed += "}".repeat(Math.max(0, openB - closeB));
      try {
        return JSON.parse(fixed);
      } catch {
        return null;
      }
    }
  }
}

function normalizeQuestion(q: any): ParsedQuestion {
  const statusRaw = String(q.status || "").toLowerCase();
  let status: QStatus = "blank";
  if (statusRaw === "wrong" || statusRaw === "incorrect" || statusRaw === "error") status = "wrong";
  else if (statusRaw === "attention" || statusRaw === "focus" || statusRaw === "review") status = "attention";
  else if (statusRaw === "correct" || statusRaw === "right") status = "correct";
  return {
    number: String(q.number ?? "").trim(),
    question: String(q.question || "").trim(),
    user_answer: String(q.user_answer || "").trim(),
    correct_answer: String(q.correct_answer || "").trim(),
    status,
    reason: String(q.reason || "").trim(),
    knowledge_point: String(q.knowledge_point || "").trim(),
    core_competency: String(q.core_competency || "").trim().slice(0, 40),
    difficulty: normalizeDifficulty(q.difficulty),
  };
}

function normalizeDifficulty(v: any): string {
  const m = String(v || "").toUpperCase().match(/L?\s*([1-6])/);
  return m ? `L${m[1]}` : "";
}

// 只以 . ? ! 作为句子结束（逗号/破折号/冒号/分号不切分），截取空(____)所在句的前一句+本句+后一句
function extractThreeSentences(raw: string): string | null {
  const text = String(raw || "").replace(/\s+/g, " ").trim();
  if (!text || !text.includes("____")) return null;
  const sentences = (text.match(/[^.?!]*[.?!]+/g) || []).map((s) => s.trim()).filter(Boolean);
  if (sentences.length === 0) return null;
  let idx = sentences.findIndex((s) => s.includes("____"));
  if (idx < 0) idx = 0;
  const from = Math.max(0, idx - 1);
  const to = Math.min(sentences.length - 1, idx + 1);
  return sentences.slice(from, to + 1).join(" ");
}

/**
 * 录题 / 错题上传接口
 * POST /api/v1/wrong-questions
 * Body: FormData 'files'（可多个，图片/PDF/Word）
 * 逐题判对错后，每题一条写入 favorites（tips 存 status/user_answer/knowledge_point），
 * 对错数据汇入能力图谱（GET /stats 按正确率推算等级）。
 */
router.post("/", authMiddleware, upload.array("files", 20), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId as number;
    const files = (req.files as Express.Multer.File[] | undefined) || [];
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: "请上传题目图片或文档" });
    }

    const images: { base64: string; mime: string }[] = [];
    const texts: string[] = [];
    let failed = 0;
    for (const f of files) {
      if (isImageMime(f.mimetype)) {
        try {
          const compressed = await sharp(f.buffer).resize(1200, 1200, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
          images.push({ base64: compressed.toString("base64"), mime: "image/jpeg" });
        } catch {
          images.push({ base64: f.buffer.toString("base64"), mime: f.mimetype });
        }
      } else {
        const text = await parseDocText(f.buffer, f.mimetype, f.originalname);
        if (text) texts.push(text);
        else failed++;
      }
    }

    if (images.length === 0 && texts.length === 0) {
      return res.status(400).json({ success: false, message: "未识别到有效的题目内容，请检查图片或文档格式" });
    }

    const recognized = await recognizeContent({ images, texts });
    const supabase = getSupabaseClient();

    // 识别失败兜底：整单作为一条待核对记录入库
    if (!recognized) {
      const { error } = await supabase.from("favorites").insert({
        user_id: userId,
        question_text: "(待核对题目) 上传内容未能逐题解析，请人工核对",
        subject: "未知",
        answer: "",
        analysis: "",
        solution: "",
        tips: JSON.stringify({ status: "attention", source: "recording" }),
        image_url: null,
      });
      if (error) return res.status(500).json({ success: false, message: "错题保存失败" });
      return res.json({
        success: true,
        message: "上传成功，但未能逐题解析，已记为待核对",
        subject: "未知",
        summary: { total: 0, correct: 0, wrong: 0, attention: 1, blank: 0 },
        warn: failed > 0 ? `${failed} 个文档无法解析` : undefined,
      });
    }

    let correct = 0, wrong = 0, attention = 0, blank = 0;
    const rows: any[] = [];
    for (const q of recognized.questions) {
      if (q.status === "correct") correct++;
      else if (q.status === "wrong") wrong++;
      else if (q.status === "attention") attention++;
      else blank++;
      rows.push({
        user_id: userId,
        question_text: q.number ? `${q.number}. ${q.question}` : q.question || "(图片题目)",
        subject: recognized.subject,
        answer: q.correct_answer || "",
        analysis: q.reason || "",
        solution: "",
        tips: JSON.stringify({
          status: q.status,
          user_answer: q.user_answer,
          knowledge_point: q.knowledge_point,
          core_competency: q.core_competency,
          difficulty: q.difficulty,
          source: "recording",
        }),
        image_url: null,
      });
    }

    // 相同题目去重：已存在同 user+同题干 的记录则更新，不重复插入
    const qTexts = rows.map((r) => r.question_text);
    const { data: existing } = await supabase
      .from("favorites")
      .select("id, question_text")
      .eq("user_id", userId)
      .in("question_text", qTexts);
    const existMap = new Map<string, string>();
    for (const e of existing || []) existMap.set(e.question_text, e.id);

    const toInsert = rows.filter((r) => !existMap.has(r.question_text));
    const toUpdate = rows.filter((r) => existMap.has(r.question_text));
    for (const r of toUpdate) {
      await supabase
        .from("favorites")
        .update({ answer: r.answer, analysis: r.analysis, tips: r.tips })
        .eq("id", existMap.get(r.question_text));
    }

    if (toInsert.length > 0) {
      const { error } = await supabase.from("favorites").insert(toInsert);
      if (error) {
        console.error("[WrongQuestions] 错题入库失败:", error.message);
        return res.status(500).json({ success: false, message: "错题保存失败: " + error.message });
      }
    }

    return res.json({
      success: true,
      message: "上传成功",
      subject: recognized.subject,
      summary: { total: recognized.questions.length, correct, wrong, attention, blank, deduped: toUpdate.length },
      warn: failed > 0 ? `${failed} 个文档无法解析（暂不支持该格式）` : undefined,
    });
  } catch (e: any) {
    console.error("[WrongQuestions] 上传接口错误:", e.message);
    res.status(500).json({ success: false, message: "上传识别失败: " + e.message });
  }
});

/**
 * 错题/收藏 学科统计（供能力图谱）
 * GET /api/v1/wrong-questions/stats
 * 按 tips.status 统计每题对错：correct 计对，wrong/attention 计错；
 * 无 status 的旧记录按错计（兼容）。正确率推算 L1-L6。
 */
router.get("/stats", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId as number;
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("favorites")
      .select("id, subject, tips")
      .eq("user_id", userId);

    if (error) {
      console.error("[WrongQuestions] 统计失败:", error.message);
      return res.status(500).json({ success: false, message: "统计失败" });
    }

    const agg: Record<string, { subject: string; correct: number; wrong: number }> = {};
    for (const row of data || []) {
      const s = row.subject || "未知";
      agg[s] = agg[s] || { subject: s, correct: 0, wrong: 0 };
      let status = "";
      try {
        status = String(JSON.parse(row.tips || "{}").status || "");
      } catch {
        status = "";
      }
      if (status === "correct") agg[s].correct++;
      else if (status === "blank") continue; // 未作答不计入正确率
      else agg[s].wrong++; // wrong / attention / 旧记录无 status
    }

    const subjects = Object.values(agg)
      .filter((a) => a.correct + a.wrong > 0)
      .map((a) => {
        const acc = a.correct / (a.correct + a.wrong);
        const level = acc >= 0.9 ? 6 : acc >= 0.75 ? 5 : acc >= 0.6 ? 4 : acc >= 0.45 ? 3 : acc >= 0.25 ? 2 : 1;
        return {
          subject: a.subject,
          wrongCount: a.wrong,
          correctCount: a.correct,
          accuracy: Math.round(acc * 100) / 100,
          level,
        };
      });

    res.json({ success: true, data: subjects });
  } catch (e: any) {
    console.error("[WrongQuestions] 统计接口错误:", e.message);
    res.status(500).json({ success: false, message: "服务器错误" });
  }
});

export default router;
