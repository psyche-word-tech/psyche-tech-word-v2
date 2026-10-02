import { Router, type Request, type Response } from "express";
import { authMiddleware } from "../middleware/auth";
import { getSupabaseClient } from "../storage/database/supabase-client";

const router = Router();

const QWEN_API_URL_DEFAULT =
  "https://ws-93mjw4d2mm946w5o.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions";

// 弦歌回响仅对教师(userId 116 / 13995589952)开放
const TEACHER_USER_ID = 116;
// 对话历史持久化到 Supabase Storage（复用 submissions bucket，避免建表）
const HISTORY_BUCKET = "submissions";
const historyPath = (userId: number) => `qwen-chat/history-${userId}.json`;

// 读取该用户保存的对话历史
router.get("/history", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const authUserId = (req as { userId?: number }).userId;
    if (authUserId !== TEACHER_USER_ID) {
      res.status(403).json({ success: false, message: "弦歌回响仅对教师开放" });
      return;
    }
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.storage
      .from(HISTORY_BUCKET)
      .download(historyPath(authUserId));
    if (error || !data) {
      res.json({ success: true, messages: [] });
      return;
    }
    const text = await data.text();
    const parsed = JSON.parse(text);
    res.json({ success: true, messages: Array.isArray(parsed) ? parsed : [] });
  } catch (err) {
    console.error("读取弦歌回响历史错误:", err);
    res.json({ success: false, messages: [] });
  }
});

// 保存整段对话历史（前端每次完整回复后整体覆盖写最新）
router.post("/history", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const authUserId = (req as { userId?: number }).userId;
    if (authUserId !== TEACHER_USER_ID) {
      res.status(403).json({ success: false, message: "弦歌回响仅对教师开放" });
      return;
    }
    const { messages } = req.body;
    if (!Array.isArray(messages)) {
      res.status(400).json({ success: false, message: "messages 参数缺失" });
      return;
    }
    // 仅保留最近 N 条，防止无限增长
    const capped = messages.slice(-100).map((m: any) => ({
      role: m?.role === "user" || m?.role === "assistant" ? m.role : "user",
      content: typeof m?.content === "string" ? m.content.slice(0, 6000) : "",
    }));
    const supabase = getSupabaseClient();
    const { error } = await supabase.storage
      .from(HISTORY_BUCKET)
      .upload(historyPath(authUserId), JSON.stringify(capped), {
        contentType: "application/json",
        upsert: true,
      });
    if (error) {
      console.error("保存弦歌回响历史错误:", error.message);
      res.status(500).json({ success: false, message: "保存历史失败" });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error("保存弦歌回响历史错误:", err?.message || err);
    res.json({ success: false, message: "服务器错误" });
  }
});

// 弦歌回响：日常与千问(默认 qwen3.8-max)对话，良师益友式答疑，SSE 流式逐字返回
router.post("/", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const authUserId = (req as { userId?: number }).userId;
    if (authUserId !== TEACHER_USER_ID) {
      res.status(403).json({ success: false, message: "弦歌回响仅对教师开放" });
      return;
    }

    const { messages, internet } = req.body;
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

    const now = new Date();
    const todayCn = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
    const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    const weekdayCn = weekdays[now.getDay()];
    const systemPrompt =
      `你今天所处的时间是${todayCn}（${weekdayCn}）。如果用户问到今天日期、几号、星期、节气、时节、时间等任何时效性问题，请直接以这个准确的日期作答。` +
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
          enable_search: !!internet,
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
      for (const raw of parts) {
        // 千问上游 SSE 行本身带 `data: ` 前缀，剥掉后再统一加，避免双重前缀解析失败
        const payload = raw.startsWith("data:") ? raw.slice(5).trim() : raw.trim();
        if (!payload) continue;
        res.write(`data: ${payload}\n\n`);
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