import express from 'express';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const router = express.Router();

interface GkWord {
  id: number;
  word: string;
  variant: string | null;
  level: string | null;
}

const LEVELS = ['base', 'required', 'elective'];

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * GET /api/v1/gk-vocab/stats
 * 返回高中课标词库总量与各等级数量
 */
router.get('/stats', async (_req, res) => {
  try {
    const client = getSupabaseClient();
    const { count: total, error } = await client
      .from('gk_vocab')
      .select('id', { count: 'exact', head: true });
    if (error) throw error;

    const levelCounts: Record<string, number> = {};
    for (const lv of LEVELS) {
      const { count, error: lerr } = await client
        .from('gk_vocab')
        .select('id', { count: 'exact', head: true })
        .eq('level', lv);
      if (lerr) throw lerr;
      levelCounts[lv] = count || 0;
    }

    res.json({ total: total || 0, levels: levelCounts });
  } catch (err: any) {
    console.error('[GkVocab] stats error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * GET /api/v1/gk-vocab/test?limit=30
 * 从高中课标词库随机抽样 N 个单词用于词汇量测试
 */
router.get('/test', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 5), 100);
    const client = getSupabaseClient();
    // PostgREST 单次 select 默认最多返回 1000 行，需分页取全量后再随机抽样
    const PAGE = 1000;
    const all: GkWord[] = [];
    let range = 0;
    for (;;) {
      const { data, error } = await client
        .from('gk_vocab')
        .select('id, word, variant, level')
        .range(range, range + PAGE - 1);
      if (error) throw error;
      const page = (data || []) as GkWord[];
      all.push(...page);
      if (page.length < PAGE) break;
      range += PAGE;
    }

    if (all.length === 0) {
      res.status(404).json({ error: '高中词库为空，请先导入数据' });
      return;
    }
    const sample = shuffle(all).slice(0, Math.min(limit, all.length));
    res.json({ total: all.length, words: sample });
  } catch (err: any) {
    console.error('[GkVocab] test error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * POST /api/v1/gk-vocab/test/submit
 * 提交判词结果：估算词汇量并写入测试记录
 * body: { answers: [{ word, known }], user_id? }
 */
router.post('/test/submit', async (req, res) => {
  try {
    const { answers, user_id } = req.body || {};
    if (!Array.isArray(answers) || answers.length === 0) {
      res.status(400).json({ error: 'answers 不能为空' });
      return;
    }

    const knownCount = answers.filter((a: any) => a && a.known === true).length;
    const sampleCount = answers.length;

    const client = getSupabaseClient();
    const { count: total, error: countErr } = await client
      .from('gk_vocab')
      .select('id', { count: 'exact', head: true });
    if (countErr) throw countErr;

    const totalWords = total || 0;
    const estimated = totalWords > 0
      ? Math.round((knownCount / sampleCount) * totalWords)
      : 0;

    const { error: insertErr } = await client.from('vocab_test_records').insert({
      user_id: user_id ? Number(user_id) : null,
      level: 'all',
      sample_count: sampleCount,
      known_count: knownCount,
      estimated_vocab: estimated,
    });
    if (insertErr) throw insertErr;

    res.json({
      known_count: knownCount,
      sample_count: sampleCount,
      total: totalWords,
      estimated_vocab: estimated,
    });
  } catch (err: any) {
    console.error('[GkVocab] submit error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;