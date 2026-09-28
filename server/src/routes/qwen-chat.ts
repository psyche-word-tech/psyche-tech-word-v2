import { Router, type Request, type Response } from "express";
import { authMiddleware } from "../middleware/auth";

const router = Router();

const QWEN_API_URL_DEFAULT =
  "https://ws-93mjw4d2mm946w5o.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions";

// 弦歌回响：日常与千问(默认 qwen3.8-max)对话，良师益友式答疑，SSE 流式逐字返回
router.post("/", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || !messages.length) {
      res.status(400).json({ success: false, message: "messages 参数缺失" });
      return;
    }

    const qwenApiUrl = process.env.QWEN_API_URL || QWEN_API_URL_DEFAULT;
    const qwenApiKey = process.env.QWEN_API_KEY || "";
    // 对话页按用户要求固定用千问 3.8 max(不随 .env 的 QWEN_MODEL=flash 走)
    const qwenModel = "qwen3.8-max";
    const chatUrl = qwenApiUrl.includes("/chat/completions")
      ? qwenApiUrl
      : `${qwenApiUrl.replace(/\/+$/, "")}/chat/completions`;

    const systemPrompt =
      "你是一位循循善诱、如沐春风的良师益友。回答学风严谨又不失温度：先正面回应问题，必要时给出思路与例子帮助理解，最后常以一句启发收束，鼓励提问者自己再往前想一步。" +
      "你可以偶用《论语》等典故中的意象（如'如切如磋、如琢如磨'）来点拨，但切勿堆砌说教。语气亲切、肯定，像一位懂学问也懂学生的师长。回答用简体中文。";

    // SSE 流式：请求千问 stream 模式，边收边转发给前端；客户端断开则中止上游
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000);

    res.on("close", () => {
      if (!res.writableEnded) controller.abort(); // 客户端断连或响应结束时停上游
      clearTimeout(timeoutId);
    });

    let resp: Response;
    try {
      resp = await fetch(chatUrl, {
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
          stream: true,
        }),
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") res.write("data: [ERROR] timed out\n\n");
      else res.write(`data: [ERROR] ${JSON.stringify(String(err.message || "network"))}\n\n`);
      res.end();
      return;
    }

    if (!resp.ok || !resp.body) {
      clearTimeout(timeoutId);
      const errorText = await resp.text();
      res.write(`data: [ERROR] http ${resp.status} ${JSON.stringify(errorText.slice(0, 300))}\n\n`);
      res.end();
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // 千问 SSE：每条以 \n\n 分隔
      const parts = buf.split("\n\n");
      buf = parts.pop() || "";
      for (const part of parts) {
        res.write(`data: ${part}\n\n`);
      }
    }
    // 收尾标记
    res.write(`data: [DONE]\n\n`);
    clearTimeout(timeoutId);
    res.end();
  } catch (err: any) {
    console.error("弦歌回响 对话接口错误:", err);
    try { res.write(`data: [ERROR] ${JSON.stringify(String(err.message || "unknown"))}\n\n`); res.end(); }
    catch { res.end(); }
  }
});

export default router;