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

/**
 * 从 PDF / Word 文档提取纯文本（复用 solve-problem 的解析方式）
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
 * 调用千问识别：给定图片（base64）与文档文本，识别题目科目并提取题干与参考答案。
 */
async function recognizeContent(content: {
  images: { base64: string; mime: string }[];
  texts: string[];
}): Promise<{ subject: string; question: string; answer: string; analysis: string; solution: string }> {
  const qwenApiUrl = (process.env.QWEN_API_URL || 'https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1').replace(/\/+$/, '');
  const chatUrl = `${qwenApiUrl}/chat/completions`;
  const apiKey = process.env.QWEN_API_KEY || '';
  const model = process.env.QWEN_MODEL || 'qwen3.8-flash';

  const messages: any[] = [
    {
      role: "system",
      content:
        "你是题目识别助手。根据用户上传的题目图片或文档文字，判定题目所属学科并提取完整题干与参考答案。只返回合法 JSON（不要 markdown 代码块），schema：" +
        `{"subject":"学科（如 数学/语文/英语/物理/化学/生物/政治/历史/地理）","question":"完整题干（含所有小题与选项）","answer":"最终答案","analysis":"简要解析","solution":"关键解题步骤"}`,
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
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const resp = await fetch(chatUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, temperature: 0.3, enable_thinking: false, max_tokens: 4000 }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`千问 API 调用失败: ${resp.status} - ${t.slice(0, 200)}`);
    }
    const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
    const contentStr = data.choices?.[0]?.message?.content || "";
    if (!contentStr) throw new Error("千问 API 返回内容为空");
    const cleaned = contentStr.replace(/```json|```/g, "").trim();
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    const jsonStr = first >= 0 && last > first ? cleaned.slice(first, last + 1) : cleaned;
    const parsed = JSON.parse(jsonStr);
    if (parsed.error) throw new Error(parsed.error);
    return {
      subject: parsed.subject || "未知",
      question: parsed.question || "",
      answer: parsed.answer || "",
      analysis: parsed.analysis || "",
      solution: parsed.solution || "",
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 录题 / 错题上传接口
 * POST /api/v1/wrong-questions
 * Body: FormData 'files'（可多个，图片/PDF/Word）
 * 后端识别科目，并把该条作为"错题"写入 favorites（我的收藏按学科查看错题）
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
          const compressed = await sharp(f.buffer).resize(900, 900, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 65 }).toBuffer();
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
    const { data, error } = await supabase
      .from("favorites")
      .insert({
        user_id: userId,
        question_text: recognized.question || "(图片题目)",
        subject: recognized.subject || "未知",
        answer: recognized.answer || "",
        analysis: recognized.analysis || "",
        solution: recognized.solution || "",
        image_url: null,
      })
      .select()
      .single();

    if (error) {
      console.error("[WrongQuestions] 错题入库失败:", error.message);
      return res.status(500).json({ success: false, message: "错题保存失败: " + error.message });
    }

    return res.json({
      success: true,
      message: "上传成功",
      subject: recognized.subject || "未知",
      data,
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
 * 返回按学科分组的错题数量与推算水平（L1-L6）
 */
router.get("/stats", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId as number;
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("favorites")
      .select("id, subject")
      .eq("user_id", userId);

    if (error) {
      console.error("[WrongQuestions] 统计失败:", error.message);
      return res.status(500).json({ success: false, message: "统计失败" });
    }

    const countBySubject: Record<string, number> = {};
    (data || []).forEach((row) => {
      const s = row.subject || "未知";
      countBySubject[s] = (countBySubject[s] || 0) + 1;
    });

    // 错题越少说明水平越高：L6=几乎无错题，/每错 1-2 题降一级，最低 L1
    const subjects = Object.keys(countBySubject).map((subject) => {
      const wrong = countBySubject[subject];
      const level = Math.max(1, Math.min(6, 6 - Math.floor((wrong - 1) / 2)));
      return { subject, wrongCount: wrong, level };
    });

    res.json({ success: true, data: subjects });
  } catch (e: any) {
    console.error("[WrongQuestions] 统计接口错误:", e.message);
    res.status(500).json({ success: false, message: "服务器错误" });
  }
});

export default router;