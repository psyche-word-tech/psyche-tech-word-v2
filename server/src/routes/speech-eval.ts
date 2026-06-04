import { Router } from "express";
import multer from "multer";
import { LLMClient, Config, ASRClient } from "coze-coding-dev-sdk";
import { spawn } from "child_process";
import ffmpegStatic from "ffmpeg-static";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// ====== ffmpeg 内存管道转换音频为 WAV (16kHz, 单声道, 16bit PCM) ======
function convertToWavBuffer(inputBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Railway 上使用系统 ffmpeg（Dockerfile 已安装）
    // 避免 ffmpeg-static 可能的路径/权限问题
    const ffmpegPath = process.env.RAILWAY_ENVIRONMENT ? "ffmpeg" : (ffmpegStatic || "ffmpeg");
    const chunks: Buffer[] = [];

    const proc = spawn(ffmpegPath, [
      "-i", "pipe:0",
      "-ar", "16000",
      "-ac", "1",
      "-sample_fmt", "s16",
      "-f", "wav",
      "pipe:1"
    ], {
      stdio: ["pipe", "pipe", "pipe"]
    });

    proc.stdin.write(inputBuffer);
    proc.stdin.end();

    proc.stdout.on("data", (chunk) => {
      chunks.push(chunk as Buffer);
    });

    proc.stderr.on("data", () => {
      // ffmpeg progress info to stderr, ignore
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}`));
        return;
      }
      resolve(Buffer.concat(chunks as any));
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

// ====== 百度语音识别 (Baidu ASR) ======

interface BaiduTokenCache {
  token: string;
  expiresAt: number;
}

let baiduTokenCache: BaiduTokenCache | null = null;

/** 计算两个字符串的相似度（0-1），基于最长公共子序列 */
function calculateSimilarity(a: string, b: string): number {
  const s1 = a.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "");
  const s2 = b.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "");
  if (!s1 && !s2) return 1;
  if (!s1 || !s2) return 0;

  // Levenshtein距离
  const m = s1.length, n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
      }
    }
  }
  const maxLen = Math.max(m, n);
  return maxLen === 0 ? 1 : 1 - dp[m][n] / maxLen;
}

/** 获取百度 access_token（带缓存） */
async function getBaiduAccessToken(): Promise<string | null> {
  const API_KEY = process.env.BAIDU_ASR_API_KEY;
  const SECRET_KEY = process.env.BAIDU_ASR_SECRET_KEY;

  if (!API_KEY || !SECRET_KEY) {
    return null;
  }

  // 缓存未过期直接返回
  if (baiduTokenCache && Date.now() < baiduTokenCache.expiresAt) {
    return baiduTokenCache.token;
  }

  try {
    const res = await fetch(
      `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${API_KEY}&client_secret=${SECRET_KEY}`,
      { method: "POST" }
    );
    const data = await res.json() as any;
    if (data.access_token) {
      // expires_in 单位是秒，提前 10 分钟过期
      baiduTokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in - 600) * 1000,
      };
      return data.access_token;
    }
  } catch (err: any) {
    console.error("[BaiduASR] Get token failed:", err.message);
  }
  return null;
}

/** 调用百度语音识别 API */
async function baiduAsrRecognize(wavBuffer: Buffer, token: string): Promise<string> {
  const base64Audio = wavBuffer.toString("base64");

  // 百度ASR REST API：所有参数放在JSON body中，URL不加查询参数
  const res = await fetch("https://vop.baidu.com/server_api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      format: "wav",
      rate: 16000,
      channel: 1,
      cuid: "wordvoyage",
      token: token,
      dev_pid: 1737,
      len: wavBuffer.length,
      speech: base64Audio,
    }),
  });

  const data = await res.json() as any;
  console.log("[BaiduASR] Response:", JSON.stringify(data));

  if (data.err_no !== 0) {
    throw new Error(`Baidu ASR error: ${data.err_msg || data.err_no}`);
  }

  return data.result?.[0] || "";
}

// ====== 评分路由 ======
router.post("/", upload.single("audio"), async (req, res) => {
  const startTime = Date.now();
  try {
    const file = req.file;
    const originalText = req.body.originalText;

    if (!file) {
      return res.status(400).json({ error: "缺少音频文件" });
    }

    if (!originalText || typeof originalText !== "string") {
      return res.status(400).json({ error: "缺少原文文本" });
    }

    const config = new Config();

    // Step 1: 转换音频为 WAV
    let wavBuffer: Buffer;
    try {
      wavBuffer = await convertToWavBuffer(file.buffer);
      console.log(`[SpeechEval] Audio converted: ${file.buffer.length} bytes -> ${wavBuffer.length} bytes WAV (${Date.now() - startTime}ms)`);
    } catch (convErr: any) {
      console.error("[SpeechEval] Audio conversion failed:", convErr.message);
      wavBuffer = file.buffer;
    }

    // Step 2: ASR 语音识别
    let transcription = "";
    const asrStart = Date.now();
    let asrMethod = "";
    let asrError = ""; // 记录ASR错误信息

    // 2a. 先尝试内置 ASR（沙箱环境）
    try {
      const asrClient = new ASRClient(config);
      const audioBase64 = wavBuffer.toString("base64");
      const asrResult = await asrClient.recognize({
        uid: "speech-eval",
        base64Data: audioBase64,
      });
      transcription = asrResult.text || "";
      asrMethod = "builtin";
      console.log(`[SpeechEval] Built-in ASR done in ${Date.now() - asrStart}ms, text="${transcription}"`);
    } catch (builtinErr: any) {
      asrError = `builtin: ${builtinErr.message}`;
      console.error(`[SpeechEval] Built-in ASR failed: ${builtinErr.message}`);

      // 2b. 内置 ASR 失败，尝试百度 ASR（Railway 环境）
      const baiduToken = await getBaiduAccessToken();
      console.log(`[SpeechEval] Baidu token: ${baiduToken ? "ok" : "null"}`);
      if (baiduToken) {
        try {
          const baiduStart = Date.now();
          transcription = await baiduAsrRecognize(wavBuffer, baiduToken);
          asrMethod = "baidu";
          console.log(`[SpeechEval] Baidu ASR done in ${Date.now() - baiduStart}ms, text="${transcription}"`);
        } catch (baiduErr: any) {
          asrError += ` | baidu: ${baiduErr.message}`;
          console.error(`[SpeechEval] Baidu ASR failed: ${baiduErr.message}`);
        }
      }
    }

    if (!transcription) {
      const hasBaiduKey = !!(process.env.BAIDU_ASR_API_KEY && process.env.BAIDU_ASR_SECRET_KEY);
      // 临时测试：直接尝试获取token并返回
      let tokenTest = "not_tested";
      try {
        const testRes = await fetch(
          `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${process.env.BAIDU_ASR_API_KEY}&client_secret=${process.env.BAIDU_ASR_SECRET_KEY}`,
          { method: "POST" }
        );
        const testData = await testRes.json() as any;
        tokenTest = testData.access_token ? `ok(${testData.access_token.substring(0, 10)}...)` : `fail:${JSON.stringify(testData).substring(0, 200)}`;
      } catch (e: any) {
        tokenTest = `error:${e.message}`;
      }
      return res.status(400).json({
        error: "未能识别到语音内容，请重新录音",
        details: asrMethod ? `ASR(${asrMethod}) 未返回结果` : (hasBaiduKey ? `百度ASR失败: ${asrError}` : "未配置百度ASR密钥"),
        debug: { hasBaiduKey, asrMethod, asrError, wavSize: wavBuffer?.length, tokenTest },
      });
    }

    // Step 3: LLM 评分（带fallback）
    let result: any;
    let scoreMethod = "llm";
    try {
      const llmStart = Date.now();
      const llmClient = new LLMClient(config);
      const messages = [
        {
          role: "system" as const,
          content: `你是一位专业的英语口语评分老师。请对比学生的朗读文本和标准原文，从以下几个维度给出评分和反馈：

评分维度（每项满分100分）：
1. 准确度（Accuracy）：学生朗读内容与原文的匹配程度
2. 流利度（Fluency）：朗读的流畅程度（通过ASR识别结果的完整性判断）
3. 发音（Pronunciation）：根据识别准确率推断发音质量

请按以下JSON格式返回结果（不要包含任何其他内容）：
{
  "accuracy": 0-100,
  "fluency": 0-100,
  "pronunciation": 0-100,
  "overall": 0-100,
  "wordCorrect": true/false,
  "feedback": "中文评价反馈，指出优点和需要改进的地方"
}

只返回JSON，不要有其他解释文字。`
        },
        {
          role: "user" as const,
          content: `标准原文：${originalText}\n学生朗读（ASR识别结果）：${transcription}\n\n请给出评分。`
        }
      ];

      const llmResponse = await llmClient.invoke(messages, {
        model: "doubao-seed-2-0-lite-260215",
        temperature: 0.3
      });

      try {
        result = JSON.parse(llmResponse.content);
      } catch (parseError) {
        const jsonMatch = llmResponse.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("AI返回格式错误");
        }
      }
      console.log(`[SpeechEval] LLM scoring done in ${Date.now() - llmStart}ms`);
    } catch (llmErr: any) {
      console.error("[SpeechEval] LLM scoring failed:", llmErr.message);
      // Fallback: 基于文本相似度评分
      scoreMethod = "similarity";
      const similarity = calculateSimilarity(originalText, transcription);
      const isCorrect = similarity >= 0.7;
      result = {
        accuracy: Math.round(similarity * 100),
        fluency: Math.round(similarity * 90 + 10),
        pronunciation: Math.round(similarity * 85 + 15),
        overall: Math.round(similarity * 100),
        wordCorrect: isCorrect,
        feedback: isCorrect
          ? `识别结果「${transcription}」与原文「${originalText}」匹配度较高，发音良好。`
          : `识别结果「${transcription}」与原文「${originalText}」有差异，建议多听标准发音后重读。`
      };
    }

    console.log(`[SpeechEval] Scoring done, method=${scoreMethod}, total=${Date.now() - startTime}ms, ASR=${asrMethod}`);

    res.json({
      success: true,
      transcription,
      _asrMethod: asrMethod,
      _scoreMethod: scoreMethod,
      ...result
    });
  } catch (error: any) {
    console.error(`[SpeechEval] Error after ${Date.now() - startTime}ms:`, error.message);
    res.status(500).json({
      error: "评分失败",
      details: error.message
    });
  }
});

export default router;
