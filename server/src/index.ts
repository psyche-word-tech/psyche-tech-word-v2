import dotenv from 'dotenv';
dotenv.config();

import express from "express";
import cors from "cors";
import { checkDatabaseHealth, startKeepAlive, resetSupabaseClient } from "./storage/database/supabase-client";
import wordsRouter from "./routes/words";
import userWordsRouter from "./routes/user-words";
import wordbooksRouter from "./routes/wordbooks";
import authRouter from "./routes/auth";
import commentsRouter from "./routes/comments";
import exampleImagesRouter from "./routes/example-images";
import grammarCheckRouter from "./routes/grammar-check";
import speechEvalRouter from "./routes/speech-eval";
import ttsRouter from "./routes/tts";
import mindmapRouter from "./routes/mindmap";

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

/**
 * 根路径健康检查 - Railway 默认健康检查
 */
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'word-voyage-api' });
});

/**
 * 健康检查接口 - 验证数据库连接
 * Railway 使用此接口判断服务是否健康
 */
app.get('/api/v1/health', async (req, res) => {
  const result = await checkDatabaseHealth();
  if (result.healthy) {
    res.status(200).json({ status: 'ok', db: 'connected' });
  } else {
    console.error('Health check failed:', result.error);
    res.status(503).json({ status: 'error', db: 'disconnected', error: result.error });
  }
});

/**
 * 重置数据库连接接口（用于手动恢复）
 */
app.post('/api/v1/health/reset', (req, res) => {
  resetSupabaseClient();
  res.status(200).json({ status: 'ok', message: 'Database connection reset' });
});

/**
 * 临时接口：创建 abcd 表并复制 words_a 数据
 */
app.post('/api/v1/admin/create-abcd', async (req, res) => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.COZE_SUPABASE_URL || '',
      process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // 1. 创建 abcd 表
    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS abcd (
          id SERIAL PRIMARY KEY,
          word TEXT,
          phonetic TEXT,
          meaning TEXT,
          example TEXT,
          translation TEXT,
          example_translation TEXT,
          example_image_url TEXT,
          example_audio_url TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `
    });

    if (createError) {
      console.log('Create table error (may already exist):', createError.message);
    }

    // 2. 清空 abcd 表
    await supabase.from('abcd').delete().neq('id', 0);

    // 3. 从 words_a 复制数据
    const { data: wordsA, error: fetchError } = await supabase.from('words_a').select('*');
    if (fetchError) throw fetchError;

    if (wordsA && wordsA.length > 0) {
      const { error: insertError } = await supabase.from('abcd').insert(wordsA);
      if (insertError) throw insertError;
    }

    // 4. 验证
    const { data: abcdData, error: verifyError } = await supabase.from('abcd').select('*');
    if (verifyError) throw verifyError;

    res.json({
      status: 'ok',
      message: 'abcd table created and data copied from words_a',
      words_a_count: wordsA?.length || 0,
      abcd_count: abcdData?.length || 0
    });
  } catch (error: any) {
    console.error('Create abcd error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 返回 API 配置信息给前端
app.get('/api/v1/config', (req, res) => {
  const baseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 
                  `${req.protocol}://${req.get('host')}`;
  res.json({ 
    apiBaseUrl: baseUrl,
    version: '1.0.0'
  });
});

// Routes
app.use('/api/v1/words', wordsRouter);
app.use('/api/v1/user-words', userWordsRouter);
app.use('/api/v1/wordbooks', wordbooksRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/comments', commentsRouter);
app.use('/api/v1/example-images', exampleImagesRouter);
app.use('/api/v1/grammar-check', grammarCheckRouter);
app.use('/api/v1/speech-eval', speechEvalRouter);
app.use('/api/v1/tts', ttsRouter);
app.use('/api/v1/mindmap', mindmapRouter);

// 全局未捕获异常处理 - 防止进程崩溃退出
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
  // 记录错误但不退出进程，保持服务可用
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
  // 记录错误但不退出进程
});

const server = app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}/`);
  // 启动数据库连接保活（每60秒检查一次）
  startKeepAlive(60000);
  console.log('Database keep-alive started');
});
