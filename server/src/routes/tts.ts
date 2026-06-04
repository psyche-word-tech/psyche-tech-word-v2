import express from "express";

const router = express.Router();

// TTS 内存缓存: text -> { buffer, timestamp }
const ttsCache = new Map<string, { buffer: Buffer; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 小时
const MAX_CACHE_SIZE = 500; // 最多缓存 500 个音频

function getCachedTTS(text: string): Buffer | null {
  const entry = ttsCache.get(text);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    ttsCache.delete(text);
    return null;
  }
  return entry.buffer;
}

function setCachedTTS(text: string, buffer: Buffer) {
  // LRU: 如果缓存满了，删除最旧的
  if (ttsCache.size >= MAX_CACHE_SIZE) {
    let oldestKey = "";
    let oldestTime = Infinity;
    for (const [key, val] of ttsCache) {
      if (val.timestamp < oldestTime) {
        oldestTime = val.timestamp;
        oldestKey = key;
      }
    }
    if (oldestKey) ttsCache.delete(oldestKey);
  }
  ttsCache.set(text, { buffer, timestamp: Date.now() });
}

router.get("/", async (req, res) => {
  const startTime = Date.now();
  try {
    const { text } = req.query;
    console.log(`[TTS] Request received, text=${text}`);

    if (!text || typeof text !== "string") {
      console.log("[TTS] Missing text parameter");
      return res.status(400).json({ error: "Missing text parameter" });
    }

    // 检查缓存
    const cached = getCachedTTS(text);
    if (cached) {
      console.log(`[TTS] Cache HIT, size=${cached.length}, time=${Date.now() - startTime}ms`);
      res.set("Content-Type", "audio/mpeg");
      res.set("Cache-Control", "public, max-age=86400");
      res.set("X-Cache", "HIT");
      return res.send(cached);
    }

    // 先尝试有道词典（单词发音效果好）
    const youdaoUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=2`;
    console.log(`[TTS] Trying Youdao: ${youdaoUrl}`);

    let youdaoOk = false;
    let audioBuffer: ArrayBuffer | null = null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 缩短到 5 秒
      const response = await fetch(youdaoUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "audio/mpeg,*/*",
          "Referer": "https://dict.youdao.com/",
        },
      });
      clearTimeout(timeout);

      if (response.ok) {
        const buf = await response.arrayBuffer();
        if (buf.byteLength > 100) {
          audioBuffer = buf;
          youdaoOk = true;
          console.log(`[TTS] Youdao OK, size=${buf.byteLength}`);
        }
      }
    } catch (e: any) {
      console.log(`[TTS] Youdao failed: ${e.message}`);
    }

    // 有道失败时 fallback 到百度翻译TTS（支持例句/长文本）
    if (!youdaoOk) {
      const baiduUrl = `https://fanyi.baidu.com/gettts?lan=en&text=${encodeURIComponent(text)}&spd=3&source=web`;
      console.log(`[TTS] Youdao failed, trying Baidu: ${baiduUrl}`);

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); // 缩短到 5 秒
        const response = await fetch(baiduUrl, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "audio/mpeg,*/*",
            "Referer": "https://fanyi.baidu.com/",
          },
        });
        clearTimeout(timeout);

        if (response.ok) {
          const buf = await response.arrayBuffer();
          if (buf.byteLength > 100) {
            audioBuffer = buf;
            console.log(`[TTS] Baidu OK, size=${buf.byteLength}`);
          }
        }
      } catch (e: any) {
        console.log(`[TTS] Baidu failed: ${e.message}`);
      }
    }

    if (!audioBuffer) {
      console.log("[TTS] All TTS sources failed");
      return res.status(502).json({ error: "All TTS sources failed" });
    }

    // 存入缓存
    const buf = Buffer.from(audioBuffer);
    setCachedTTS(text, buf);

    console.log(`[TTS] Audio size: ${buf.length} bytes, time: ${Date.now() - startTime}ms`);

    res.set("Content-Type", "audio/mpeg");
    res.set("Cache-Control", "public, max-age=86400");
    res.set("X-Cache", "MISS");
    res.send(buf);
  } catch (error: any) {
    console.error(`[TTS] Error after ${Date.now() - startTime}ms:`, error.message || error);
    res.status(500).json({ error: "Failed to fetch TTS audio", detail: error.message });
  }
});

export default router;
