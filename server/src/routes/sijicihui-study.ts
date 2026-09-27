import { Router, type Request, type Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';

const router = Router();

const VALID_STATUS = ['new', 'known', 'vague', 'unknown'];

interface StudyWord {
  id: number;
  word: string;
  phonetic: string | null;
  meaning: string | null;
  status: string;
}

/**
 * 四级词汇学习记忆路由（per-user 隔离）
 * 所有查询/写入都以 req.userId 为界，users 数据完全隔离。
 * 未登录一律 401；越权（他人 userId）无任何入口。
 */

// GET /api/v1/sijicihui-study/progress -> 当前用户学习统计
router.get('/progress', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId as number;
    const supabase = getSupabaseClient();

    const { count: total = 0, error: err0 } = await supabase
      .from('sijicihui')
      .select('id', { count: 'exact', head: true });
    if (err0) {
      console.error('[SijicihuiStudy] 统计总数失败:', err0.message);
      return res.status(500).json({ success: false, message: '查询失败: ' + err0.message });
    }

    const counts = { new: 0, known: 0, vague: 0, unknown: 0 };
    const { data: rows, error: err1 } = await supabase
      .from('sijicihui_progress')
      .select('status')
      .eq('user_id', userId);
    if (err1) {
      console.error('[SijicihuiStudy] 进度查询失败:', err1.message);
      return res.status(500).json({ success: false, message: '查询失败: ' + err1.message });
    }
    (rows || []).forEach((r: any) => {
      if (VALID_STATUS.includes(r.status)) counts[r.status as keyof typeof counts] += 1;
    });

    const learned = counts.known + counts.vague + counts.unknown;
    const pending = Math.max(0, (total as number) - learned);
    return res.json({
      success: true,
      data: {
        total: total as number,
        learned,
        pending,
        known: counts.known,
        vague: counts.vague,
        unknown: counts.unknown,
      },
    });
  } catch (error: any) {
    console.error('[SijicihuiStudy] 统计异常:', error.message);
    return res.status(500).json({ success: false, message: '查询失败: ' + error.message });
  }
});

// GET /api/v1/sijicihui-study/words?status=&page=&limit=
// 默认返回该用户"待学"词（未标记 或 status=new）；传 status=known/vague/unknown 返回对应分类复习词
router.get('/words', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId as number;
    const q = req.query as Record<string, string | undefined>;
    const status = (q.status ?? '').trim();
    const page = Math.max(1, parseInt(q.page ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? '20', 10) || 20));

    const supabase = getSupabaseClient();
    const { data: words, error: err0 } = await supabase
      .from('sijicihui')
      .select('id, word, phonetic, meaning')
      .order('id');
    if (err0) {
      console.error('[SijicihuiStudy] 取词失败:', err0.message);
      return res.status(500).json({ success: false, message: '查询失败: ' + err0.message });
    }

    const { data: prog, error: err1 } = await supabase
      .from('sijicihui_progress')
      .select('word_id, status')
      .eq('user_id', userId);
    if (err1) {
      console.error('[SijicihuiStudy] 进度读取失败:', err1.message);
      return res.status(500).json({ success: false, message: '查询失败: ' + err1.message });
    }

    const statusMap = new Map<number, string>();
    (prog || []).forEach((p: any) => statusMap.set(p.word_id, p.status));

    let filtered: StudyWord[] = (words || []).map((w: any) => ({
      id: w.id,
      word: w.word,
      phonetic: w.phonetic,
      meaning: w.meaning,
      status: statusMap.get(w.id) || 'new',
    }));

    if (VALID_STATUS.includes(status)) {
      filtered = filtered.filter((w) => w.status === status);
    } else {
      // 默认待学：未标记 或 标记回 new
      filtered = filtered.filter((w) => w.status === 'new');
    }

    const start = (page - 1) * limit;
    return res.json({
      success: true,
      count: filtered.length,
      page,
      limit,
      data: filtered.slice(start, start + limit),
    });
  } catch (error: any) {
    console.error('[SijicihuiStudy] 取词异常:', error.message);
    return res.status(500).json({ success: false, message: '查询失败: ' + error.message });
  }
});

// POST /api/v1/sijicihui-study/status  { wordId, status }  -> 记录当前用户对该词的记忆状态
router.post('/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId as number;
    const { wordId, status } = req.body || {};
    const wordIdNum = typeof wordId === 'string' ? parseInt(wordId, 10) : wordId;
    if (!wordIdNum || !VALID_STATUS.includes(status)) {
      return res.status(400).json({ success: false, message: 'wordId 与 status 必填且 status 需为 known/vague/unknown/new' });
    }

    const supabase = getSupabaseClient();
    // 确认词存在
    const { data: word, error: errWord } = await supabase
      .from('sijicihui')
      .select('id')
      .eq('id', wordIdNum)
      .maybeSingle();
    if (errWord) {
      console.error('[SijicihuiStudy] 查词失败:', errWord.message);
      return res.status(500).json({ success: false, message: '查询失败: ' + errWord.message });
    }
    if (!word) {
      return res.status(404).json({ success: false, message: '单词不存在' });
    }

    const now = new Date().toISOString();
    const { data: existing, error: errExist } = await supabase
      .from('sijicihui_progress')
      .select('id, review_count')
      .eq('user_id', userId)
      .eq('word_id', wordIdNum)
      .maybeSingle();
    if (errExist) {
      console.error('[SijicihuiStudy] 查进度失败:', errExist.message);
      return res.status(500).json({ success: false, message: '查询失败: ' + errExist.message });
    }

    if (existing) {
      const { error: errUpd } = await supabase
        .from('sijicihui_progress')
        .update({ status, review_count: (existing.review_count || 0) + 1, last_review_at: now })
        .eq('id', existing.id);
      if (errUpd) {
        console.error('[SijicihuiStudy] 更新失败:', errUpd.message);
        return res.status(500).json({ success: false, message: '更新失败: ' + errUpd.message });
      }
    } else {
      const { error: errIns } = await supabase
        .from('sijicihui_progress')
        .insert({ user_id: userId, word_id: wordIdNum, status, review_count: 1, last_review_at: now });
      if (errIns) {
        console.error('[SijicihuiStudy] 写入失败:', errIns.message);
        return res.status(500).json({ success: false, message: '写入失败: ' + errIns.message });
      }
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[SijicihuiStudy] 状态上报异常:', error.message);
    return res.status(500).json({ success: false, message: '上报失败: ' + error.message });
  }
});

export default router;