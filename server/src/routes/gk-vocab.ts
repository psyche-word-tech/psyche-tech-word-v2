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

/** 提取释义开头的词性标注（如 "v."、"adj."、"prep."），无标注返回 '' */
function mainPos(meaning: string | null): string {
  const t = (meaning || '').trim();
  const m = t.match(/^\[\s*([a-z/.]+)\s*\]?\./i) || t.match(/^([A-Za-z/.]+)\./);
  if (!m) return '';
  // v./n. → v；取第一个子词性作为主导词性
  return m[1].split('/')[0].trim().toLowerCase();
}

/** 语义相近的词性归并，避免 n./adj./adv. 混用 */
function posKey(p: string): string {
  const map: Record<string, string> = { v: 'verb', verb: 'verb', n: 'noun', noun: 'noun', adj: 'adj', adjective: 'adj', adv: 'adv', adverb: 'adv', prep: 'prep', preposition: 'prep', conj: 'conj', conjunction: 'conj', pron: 'pron', pronoun: 'pron' };
  return map[p] || ('other_' + p);
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
    const perLevel = Math.min(Math.max(Number(req.query.per_level) || 40, 5), 80);
    const all = await fetchAllWords();
    // 出题池 = 已有释义的词
    const pool = all.filter((w) => w.meaning && w.meaning.trim());
    if (pool.length < 5) {
      res.status(404).json({ error: '可出题的词不足（缺少中文释义）' });
      return;
    }
    // 按 level 分组，每类随机抽 perLevel 个
    const byLevel: Record<string, GkWord[]> = { base: [], required: [], elective: [] };
    for (const w of pool) {
      if (w.level && byLevel[w.level]) byLevel[w.level].push(w);
    }
    const sample: GkWord[] = [];
    const perLevelCounts: Record<string, number> = { base: 0, required: 0, elective: 0 };
    for (const lv of LEVELS) {
      const arr = shuffle(byLevel[lv] || []);
      const take = arr.slice(0, perLevel);
      sample.push(...take);
      perLevelCounts[lv] = take.length;
    }

    // 预建按主导词性分组的词池：同词性词作为干扰项候选
    const byPos = new Map<string, GkWord[]>();
    for (const w of pool) {
      const key = posKey(mainPos(w.meaning));
      if (!byPos.has(key)) byPos.set(key, []);
      byPos.get(key)!.push(w);
    }

    const questions = sample.map((w) => {
      const correct = firstMeaning(w.meaning);
      const pos = posKey(mainPos(w.meaning));
      const samePosPool = (byPos.get(pos) || []).filter((x) => x.id !== w.id);
      // 优先同词性干扰项；不足则用整池补足
      const distractors: string[] = [];
      for (const c of shuffle(samePosPool)) {
        if (distractors.length >= 4) break;
        const m = firstMeaning(c.meaning);
        if (m === correct || distractors.includes(m)) continue;
        distractors.push(m);
      }
      if (distractors.length < 4) {
        for (const c of shuffle(pool.filter((x) => x.id !== w.id))) {
          if (distractors.length >= 4) break;
          const m = firstMeaning(c.meaning);
          if (m === correct || distractors.includes(m)) continue;
          distractors.push(m);
        }
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

    res.json({ total: pool.length, sampleCount: questions.length, perLevelCounts, questions });
  } catch (err: any) {
    console.error('[GkVocab] test error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/** 分等级统计有释义的词池大小 */
async function fetchLevelPoolCounts(): Promise<Record<string, number>> {
  const client = getSupabaseClient();
  const out: Record<string, number> = {};
  for (const lv of LEVELS) {
    const { count, error } = await client
      .from('gk_vocab')
      .select('id', { count: 'exact', head: true })
      .eq('level', lv)
      .not('meaning', 'is', null)
      .neq('meaning', '');
    if (error) throw error;
    out[lv] = count || 0;
  }
  return out;
}

/**
 * POST /api/v1/gk-vocab/test/submit
 * body: { answers: [{ id, chosen }], user_id? }
 * 按 level（base/required/elective）分别计算识别率，并依据各等级词池大小估算总体词汇量。
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
      .select('id, meaning, level')
      .in('id', ids.length ? ids : [0]);
    if (error) throw error;
    const metaMap = new Map<number, { meaning: string; level: string }>(
      ((data || []) as { id: number; meaning: string | null; level: string | null }[]).map((r) => [
        r.id,
        { meaning: r.meaning || '', level: r.level || 'base' },
      ])
    );

    // 分等级统计
    const perLevel: Record<string, { sample: number; correct: number }> = {};
    for (const lv of LEVELS) perLevel[lv] = { sample: 0, correct: 0 };
    for (const a of answers) {
      const meta = metaMap.get(Number(a.id));
      const lv = meta && LEVELS.includes(meta.level) ? meta.level : 'base';
      perLevel[lv].sample++;
      const corr = meta ? meta.meaning : '';
      if (a.chosen && firstMeaning(corr) === String(a.chosen).trim()) {
        perLevel[lv].correct++;
      }
    }

    // 各等级词池大小
    const poolCounts = await fetchLevelPoolCounts();

    // 各等级识别率
    const levelResult: Record<string, { sample: number; correct: number; total: number; rate: number }> = {};
    let correctCount = 0;
    let sampleCount = 0;
    for (const lv of LEVELS) {
      const s = perLevel[lv];
      const total = poolCounts[lv] || 0;
      const rate = s.sample > 0 ? s.correct / s.sample : 0;
      levelResult[lv] = { sample: s.sample, correct: s.correct, total, rate };
      correctCount += s.correct;
      sampleCount += s.sample;
    }

    // 总体词汇量 = Σ(该等级识别率 × 该等级词池大小)
    const estimated = Math.round(levelResult.base.rate * levelResult.base.total
      + levelResult.required.rate * levelResult.required.total
      + levelResult.elective.rate * levelResult.elective.total);
    const totalWords = poolCounts.base + poolCounts.required + poolCounts.elective;

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
      levels: levelResult,
    });
  } catch (err: any) {
    console.error('[GkVocab] submit error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;