import express from 'express';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const router = express.Router();

interface GkWord {
  id: number;
  word: string;
  variant: string | null;
  level: string | null;
  meaning: string | null;
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

function firstMeaning(m: string | null): string {
  // 释义可能形如 "苹果；[a]..."，取第一含义作为正确答案文本
  return (m || '').split('；')[0].split(';')[0].trim();
}

/** 分页取全量高中词（含释义） */
async function fetchAllWords(): Promise<GkWord[]> {
  const client = getSupabaseClient();
  const PAGE = 1000;
  const all: GkWord[] = [];
  let range = 0;
  for (;;) {
    const { data, error } = await client
      .from('gk_vocab')
      .select('id, word, variant, level, meaning')
      .range(range, range + PAGE - 1);
    if (error) throw error;
    const page = (data || []) as GkWord[];
    all.push(...page);
    if (page.length < PAGE) break;
    range += PAGE;
  }
  return all;
}

async function fetchPoolSize(): Promise<number> {
  const client = getSupabaseClient();
  const { count, error } = await client
    .from('gk_vocab')
    .select('id', { count: 'exact', head: true })
    .not('meaning', 'is', null)
    .neq('meaning', '');
  if (error) throw error;
  return count || 0;
}

/**
 * GET /api/v1/gk-vocab/stats
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
 * GET /api/v1/gk-vocab/test?limit=120
 * 随机抽样 N 个单词，每个给出 5 个中文选项（1 正确 + 4 干扰项，乱序）。
 * 响应不含正确项信息，前端只能提交选中项，由 /submit 按 word 正确释义比对判对。
 */
router.get('/test', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 120, 10), 200);
    const all = await fetchAllWords();
    // 出题池 = 已有释义的词
    const pool = all.filter((w) => w.meaning && w.meaning.trim());
    if (pool.length < 5) {
      res.status(404).json({ error: '可出题的词不足（缺少中文释义）' });
      return;
    }
    const sample = shuffle(pool).slice(0, Math.min(limit, pool.length));

    const questions = sample.map((w) => {
      const correct = firstMeaning(w.meaning);
      // 从整池中随机取 4 个不同释义作干扰项
      const distractors: string[] = [];
      const candidates = shuffle(pool.filter((x) => x.id !== w.id));
      for (const c of candidates) {
        if (distractors.length >= 4) break;
        const m = firstMeaning(c.meaning);
        if (m === correct || distractors.includes(m)) continue;
        distractors.push(m);
      }
      const options = shuffle([correct, ...distractors].slice(0, 5));
      return {
        id: w.id,
        word: w.word,
        level: w.level,
        variant: w.variant,
        options,
      };
    });

    res.json({ total: pool.length, sampleCount: questions.length, questions });
  } catch (err: any) {
    console.error('[GkVocab] test error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * POST /api/v1/gk-vocab/test/submit
 * body: { answers: [{ id, chosen }], user_id? }
 * chosen 是用户选定的中文选项文本；后端按 word 的正确释义比对，选对才算对。
 */
router.post('/test/submit', async (req, res) => {
  try {
    const { answers, user_id } = req.body || {};
    if (!Array.isArray(answers) || answers.length === 0) {
      res.status(400).json({ error: 'answers 不能为空' });
      return;
    }

    const ids = answers.map((a: any) => Number(a.id)).filter((n: number) => Number.isFinite(n));
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('gk_vocab')
      .select('id, meaning')
      .in('id', ids.length ? ids : [0]);
    if (error) throw error;
    const meaningMap = new Map<number, string>(
      ((data || []) as { id: number; meaning: string | null }[]).map((r) => [r.id, (r.meaning || '')])
    );

    let correctCount = 0;
    for (const a of answers) {
      const corr = meaningMap.get(Number(a.id)) || '';
      if (a.chosen && firstMeaning(corr) === String(a.chosen).trim()) {
        correctCount++;
      }
    }
    const sampleCount = answers.length;

    const totalWords = await fetchPoolSize();
    const estimated = totalWords > 0 ? Math.round((correctCount / sampleCount) * totalWords) : 0;

    const { error: insertErr } = await client.from('vocab_test_records').insert({
      user_id: user_id ? Number(user_id) : null,
      level: 'all',
      sample_count: sampleCount,
      known_count: correctCount,
      estimated_vocab: estimated,
    });
    if (insertErr) throw insertErr;

    res.json({
      correct_count: correctCount,
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