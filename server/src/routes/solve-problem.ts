import { Router } from "express";
import multer from "multer";
import { LLMClient, Config } from "coze-coding-dev-sdk";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * 搜题接口 - 接收图片，调用多模态大模型解析题目
 * POST /api/v1/solve-problem
 * Body: FormData with 'image' field (image file)
 */
router.post("/", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "请上传图片" });
    }

    const imageBuffer = req.file.buffer;
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

请按以下 JSON 格式返回结果：
{
  "subject": "学科（如数学、物理、化学、英语等）",
  "question": "题目内容（文字描述）",
  "analysis": "题目分析（考查知识点、解题思路）",
  "solution": "详细解答过程",
  "answer": "最终答案",
  "tips": "解题技巧或注意事项（可选）"
}

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
            text: "请解析这道题目。",
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

    let result: any;
    try {
      result = JSON.parse(llmResponse.content);
    } catch (parseError) {
      const jsonMatch = llmResponse.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        result = {
          subject: "未知",
          question: "无法解析题目内容",
          analysis: llmResponse.content,
          solution: "",
          answer: "",
        };
      }
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
