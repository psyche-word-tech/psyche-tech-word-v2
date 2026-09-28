import { Router, type Request, type Response } from "express";
import { authMiddleware } from "../middleware/auth";

const router = Router();

const QWEN_API_URL_DEFAULT =
  "https://ws-93mjw4d2mm946w5o.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions";

// 弦歌回响：日常与千问(默认 qwen3.8-max)对话，良师益友式答疑
// 多轮上下文由前端维护，payload 直接透传历史 messages 给模型
router.post("/", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || !messages.length) {
      res.status(400).json({ success: false, message: "messages 参数缺失" });
      return;
    }

    const qwenApiUrl = process.env.QWEN_API_URL || QWEN_API_URL_DEFAULT;
    const qwenApiKey = process.env.QWEN_API_KEY || "";
    const qwenModel = process.env.QWEN_MODEL || "qwen3.8-max";
    const chatUrl = qwenApiUrl.includes("/chat/completions")
      ? qwenApiUrl
      : `${qwenApiUrl.replace(/\/+$/, "")}/chat/completions`;

    // 角色设定：良师益友 + 孔子弦歌不辍的循循善诱风格
    const systemPrompt =
      "你是一位循循善诱、如沐春风的良师益友。回答学风严谨又不失温度：先正面回应问题，必要时给出思路与例子帮助理解，最后常以一句启发收束，鼓励提问者自己再往前想一步。" +
      "你可以偶用《论语》等典故中的意象（如'如切如磋、如琢如磨'）来点拨，但切勿堆砌说教。语气亲切、肯定，像一位懂学问也懂学生的师长。回答用简体中文。";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    const resp = await fetch(chatUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${qwenApiKey}`,
      },
      body: JSON.stringify({
        model: qwenModel,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature: 0.7,
        enable_thinking: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      const errorText = await resp.text();
      res.status(502).json({ success: false, message: `千问 API 调用失败: ${resp.status}` });
      return;
    }

    const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content || "";
    if (!content) {
      res.status(502).json({ success: false, message: "千问 API 返回内容为空" });
      return;
    }

    res.json({ success: true, content });
  } catch (err: any) {
    if (err.name === "AbortError") {
      res.status(504).json({ success: false, message: "请求超时，请稍后重试" });
      return;
    }
    console.error("弦歌回响 对话接口错误:", err);
    res.status(500).json({ success: false, message: "对话服务异常" });
  }
});

export default router;