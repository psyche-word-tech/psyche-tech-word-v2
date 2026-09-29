import express from 'express';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { optionalAuthMiddleware } from '@/middleware/auth';

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

/** 清理释义中的词性标注（开头 "adj. "/"[v.] " 及内嵌 "；[n]"、" n. "、" ;adv. "），保留中文含义 */
function stripPosPrefix(m: string): string {
  let s = (m || '').trim();
  // 去开头的 "[v.] " 或 "adj. " / "adv./prep. "
  s = s.replace(/^\[[^\]]*\]\s*/, '').replace(/^[A-Za-z][A-Za-z/.]*\.\s*/, '');
  // 清理内嵌 "；[v]" / "；[n]" 段
  s = s.replace(/[；;]\s*\[[^\]]*\]/g, '');
  // 清理 "；adv." / " ;n." / "； prep." 前导词性（保留其后同段含义），以及句中独立 " n. " / " v. "
  s = s.replace(/[；;]\s*[A-Za-z][A-Za-z/.]*\./g, '；');
  s = s.replace(/\s+[A-Za-z][A-Za-z/.]*\.\s*/g, ' ');
  // 折叠空段位与收尾分号
  s = s.replace(/[；;]+\s*[；;]*/g, '；').replace(/[；;]\s*$/, '').trim();
  return s;
}

/** 完整释义：去掉词性前缀，保留全部含义（不截取第一段） */
function fullMeaning(m: string | null): string {
  return stripPosPrefix(m || '');
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
      const correct = fullMeaning(w.meaning);
      const pos = posKey(mainPos(w.meaning));
      const samePosPool = (byPos.get(pos) || []).filter((x) => x.id !== w.id);
      // 优先同词性干扰项；不足则用整池补足
      const distractors: string[] = [];
      for (const c of shuffle(samePosPool)) {
        if (distractors.length >= 4) break;
        const m = fullMeaning(c.meaning);
        if (m === correct || distractors.includes(m)) continue;
        distractors.push(m);
      }
      if (distractors.length < 4) {
        for (const c of shuffle(pool.filter((x) => x.id !== w.id))) {
          if (distractors.length >= 4) break;
          const m = fullMeaning(c.meaning);
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
      if (a.chosen && fullMeaning(corr) === String(a.chosen).trim()) {
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

    // 多行插入：每个等级一行 + 总体一行，便于教师按用户统计分项词汇量
    const uid = user_id ? Number(user_id) : null;
    const rows: { user_id: number | null; level: string; sample_count: number; known_count: number; estimated_vocab: number }[] = LEVELS.map((lv) => {
      const s = perLevel[lv];
      const total = poolCounts[lv] || 0;
      const est = Math.round((s.sample > 0 ? s.correct / s.sample : 0) * total);
      return { user_id: uid, level: lv, sample_count: s.sample, known_count: s.correct, estimated_vocab: est };
    });
    rows.push({ user_id: uid, level: 'all', sample_count: sampleCount, known_count: correctCount, estimated_vocab: estimated });

    const { error: insertErr } = await client.from('vocab_test_records').insert(rows);
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

/**
 * GET /api/v1/gk-vocab/stats/users
 * 教师查看所有做过词汇量测试的用户的词汇量统计。
 * 每个用户取最近一次测试，返回 基础词/必修词/选修词/总体词汇量，末尾附汇总行。
 */
router.get('/stats/users', optionalAuthMiddleware, (_req, res) => {
  void (async () => {
  try {
    const req = _req as any;
    if (!req.userId || req.userId !== 116) {
      res.status(403).json({ error: '无权限：仅限教师查看' });
      return;
    }
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('vocab_test_records')
      .select('user_id, level, sample_count, known_count, estimated_vocab, created_at')
      .not('user_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(2000);
    if (error) throw error;
    const rows = data || [];

    // 对每个 (用户, 等级) 独立取其最新一条（created_at 已 desc，首次赋值即最新）
    const latest = new Map<string, { est: number; time?: string }>();
    for (const r of rows) {
      const uid = Number(r.user_id);
      if (!r.level) continue;
      const key = `${uid}:${r.level}`;
      if (!latest.has(key)) latest.set(key, { est: Number(r.estimated_vocab) });
    }

    const users = new Map<number, { base?: number; required?: number; elective?: number; total?: number }>();
    for (const [key, v] of latest) {
      const i = key.lastIndexOf(':');
      const uid = Number(key.slice(0, i));
      const lv = key.slice(i + 1);
      if (!users.has(uid)) users.set(uid, {});
      const rec = users.get(uid)!;
      if (lv === 'base') rec.base = v.est;
      else if (lv === 'required') rec.required = v.est;
      else if (lv === 'elective') rec.elective = v.est;
      else if (lv === 'all') rec.total = v.est;
    }

    // 用户名（users 表）
    const { data: urows } = await client.from('users').select('id, username, phone');
    const nameMap = new Map<number, string>();
    for (const u of (urows || [])) {
      nameMap.set(Number(u.id), (u as any).username || (u as any).phone || `用户${u.id}`);
    }

    const list = Array.from(users.entries()).map(([uid, rec]) => {
      const hasAll = ['base', 'required', 'elective'].every((lv) => rec[lv as 'base'] !== undefined);
      const hasTotal = rec.total !== undefined;
      const base = rec.base ?? 0, required = rec.required ?? 0, elective = rec.elective ?? 0;
      return {
        user_id: uid,
        name: nameMap.get(uid) || `用户${uid}`,
        base,
        required,
        elective,
        total: rec.total ?? (base + required + elective),
        // 只有历史 all 记录、无分等级行：标记为「仅总量」历史数据，前端提示重新测试
        incomplete: !hasAll && hasTotal,
      };
    }).sort((a, b) => b.total - a.total);

    // 汇总行（分等级缺失的历史用户不计入分项合计，避免与总量口径混算）
    const summary = {
      users: list.length,
      base: list.reduce((s, r) => s + r.base, 0),
      required: list.reduce((s, r) => s + r.required, 0),
      elective: list.reduce((s, r) => s + r.elective, 0),
      total: list.reduce((s, r) => s + r.total, 0),
    };

    res.json({ list, summary });
  } catch (err: any) {
    console.error('[GkVocab] stats users error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
  })();
});

export default router;