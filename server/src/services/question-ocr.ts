import sharp from "sharp";

/**
 * 收藏后台用：把题目图片交给千问视觉模型，转成结构化文字题干。
 * 只取题干识别，用 flash 模型保证收藏响应够快。
 * 返回 { question, subject, answer, analysis, solution, tips }
 * 失败时抛错，由调用方兜底（尝试用图片 URL 存收藏）。
 */
export async function extractQuestionFromImage(imageBuffer: Buffer): Promise<{
  question: string;
  subject: string;
  answer: string;
  analysis: string;
  solution: string;
  tips: string;
}> {
  let imageBase64 = imageBuffer.toString("base64");
  let mimeType = "image/jpeg";
  try {
    const compressed = await sharp(imageBuffer)
      .resize(900, 900, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 65 })
      .toBuffer();
    imageBase64 = compressed.toString("base64");
    console.log(`[FavoriteOCR] 图片压缩: ${Math.round(imageBuffer.length / 1024)}KB -> ${Math.round(compressed.length / 1024)}KB`);
  } catch (e) {
    console.warn("[FavoriteOCR] 图片压缩失败，使用原图:", (e as Error).message);
  }

  const qwenApiUrl = (process.env.QWEN_API_URL || 'https://ws-93mjw4d2mm946w5o.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions')
    .replace(/\/chat\/completions$/, '');
  const qwenApiKey = process.env.QWEN_API_KEY || '';
  const chatUrl = `${qwenApiUrl.replace(/\/+$/, '')}/chat/completions`;
  const model = 'qwen3.8-flash';

  const system = `你是题目识别助手。请识别题目图片，提取完整题干（含选项）与学科。返回合法 JSON（不要 markdown 代码块），schema：
{
  "question": "完整题干（含选项，务必逐字保留，含所有小题）",
  "subject": "学科",
  "answer": "最终答案（若图片自带参考答案则严格一致；没有则给出你的解答）",
  "analysis": "简要解析",
  "solution": "关键解题步骤",
  "tips": "解题技巧（可选）"
}
规则：题干必须完整保留原文；公式用 LaTeX 加 $ 包裹；只返回 JSON。若图片不清晰返回 {"error":"图片不清晰"}`;

  const messages = [
    { role: "system", content: system },
    {
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        { type: "text", text: "请识别图片中的题目并提取完整题干与解答。" },
      ],
    },
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const resp = await fetch(chatUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${qwenApiKey}` },
      body: JSON.stringify({ model, messages, temperature: 0.3, enable_thinking: false }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`千问 API 调用失败: ${resp.status} - ${text.slice(0, 200)}`);
    }
    const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content || "";
    if (!content) throw new Error("千问 API 返回内容为空");

    // 容错提取 JSON
    const cleaned = content.replace(/```json|```/g, "").trim();
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    const jsonStr = first >= 0 && last > first ? cleaned.slice(first, last + 1) : cleaned;
    const parsed = JSON.parse(jsonStr);
    if (parsed.error) throw new Error(parsed.error);
    console.log(`[FavoriteOCR] 识别完成 question=${(parsed.question || "").slice(0, 40)}`);
    return {
      question: parsed.question || "",
      subject: parsed.subject || "未知",
      answer: parsed.answer || "",
      analysis: parsed.analysis || "",
      solution: parsed.solution || "",
      tips: parsed.tips || "",
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof SyntaxError) {
      throw new Error("题目识别 JSON 解析失败");
    }
    throw err;
  }
}