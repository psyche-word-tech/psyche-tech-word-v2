import { Router, type Request, type Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';

const router = Router();

const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
type Season = (typeof SEASONS)[number];

function isSeason(v: any): v is Season {
  return typeof v === 'string' && (SEASONS as readonly string[]).includes(v);
}

// 查询当前登录用户的四季词汇，可按季节过滤
const list = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const supabase = getSupabaseClient();
    const season = (req.query as any).season as string | undefined;

    let query = supabase.from('sijicihui').select('*').eq('user_id', userId);
    if (season && season !== 'all') {
      if (!isSeason(season)) {
        return res.status(400).json({ success: false, message: 'season 必须为 spring/summer/autumn/winter' });
      }
      query = query.eq('season', season);
    }
    const { data, error } = await query.order('created_at', { ascending: true });
    if (error) {
      console.error('[Sijicihui] 查询失败:', error.message);
      return res.status(500).json({ success: false, message: '查询失败: ' + error.message });
    }
    return res.json({ success: true, data: data ?? [] });
  } catch (error: any) {
    console.error('[Sijicihui] 查询异常:', error.message);
    res.status(500).json({ success: false, message: '查询失败: ' + error.message });
  }
};

// 新增一个单词
const create = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const supabase = getSupabaseClient();
    const { word, phonetic, part_of_speech, meaning, sentence, season } = req.body ?? {};

    if (!word || !meaning) {
      return res.status(400).json({ success: false, message: 'word 和 meaning 不能为空' });
    }
    const seasonValue = season === undefined ? 'spring' : season;
    if (!isSeason(seasonValue)) {
      return res.status(400).json({ success: false, message: 'season 必须为 spring/summer/autumn/winter' });
    }

    // 同一用户不允许重复收藏同一单词
    const { data: dup } = await supabase
      .from('sijicihui')
      .select('id')
      .eq('user_id', userId)
      .eq('word', word.trim())
      .limit(1);
    if (dup && dup.length > 0) {
      return res.status(409).json({ success: false, message: '该单词已存在' });
    }

    const { data, error } = await supabase
      .from('sijicihui')
      .insert({
        user_id: userId,
        word: word.trim(),
        phonetic: phonetic ?? null,
        part_of_speech: part_of_speech ?? null,
        meaning,
        sentence: sentence ?? null,
        season: seasonValue,
      })
      .select()
      .single();

    if (error) {
      console.error('[Sijicihui] 新增失败:', error.message);
      return res.status(500).json({ success: false, message: '新增失败: ' + error.message });
    }
    return res.status(201).json({ success: true, data });
  } catch (error: any) {
    console.error('[Sijicihui] 新增异常:', error.message);
    res.status(500).json({ success: false, message: '新增失败: ' + error.message });
  }
};

// 确保记录属于当前用户
const ownRecord = async (supabase: any, id: string, userId: number) => {
  const { data, error } = await supabase
    .from('sijicihui')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

// 更新一个单词（仅限自己的）
const update = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const supabase = getSupabaseClient();
    const id = (req.params as any).id;
    if (!id || /^\d+$/.test(String(id)) === false) {
      return res.status(400).json({ success: false, message: '非法 id' });
    }

    const origin = await ownRecord(supabase, String(id), userId);
    if (!origin) {
      return res.status(404).json({ success: false, message: '记录不存在或无权操作' });
    }

    const body = req.body ?? {};
    const patch: Record<string, any> = {};
    if (body.word !== undefined) {
      if (!body.word) return res.status(400).json({ success: false, message: 'word 不能为空' });
      patch.word = String(body.word).trim();
    }
    if (body.phonetic !== undefined) patch.phonetic = body.phonetic ?? null;
    if (body.part_of_speech !== undefined) patch.part_of_speech = body.part_of_speech ?? null;
    if (body.meaning !== undefined) {
      if (!body.meaning) return res.status(400).json({ success: false, message: 'meaning 不能为空' });
      patch.meaning = body.meaning;
    }
    if (body.sentence !== undefined) patch.sentence = body.sentence ?? null;
    if (body.season !== undefined) {
      if (!isSeason(body.season)) return res.status(400).json({ success: false, message: 'season 必须为 spring/summer/autumn/winter' });
      patch.season = body.season;
    }

    const { data, error } = await supabase
      .from('sijicihui')
      .update(patch)
      .eq('id', String(id))
      .eq('user_id', userId)
      .select()
      .single();
    if (error) {
      console.error('[Sijicihui] 更新失败:', error.message);
      return res.status(500).json({ success: false, message: '更新失败: ' + error.message });
    }
    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('[Sijicihui] 更新异常:', error.message);
    res.status(500).json({ success: false, message: '更新失败: ' + error.message });
  }
};

// 删除（仅限自己的）
const remove = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const supabase = getSupabaseClient();
    const id = (req.params as any).id;
    if (!id || /^\d+$/.test(String(id)) === false) {
      return res.status(400).json({ success: false, message: '非法 id' });
    }

    const origin = await ownRecord(supabase, String(id), userId);
    if (!origin) {
      return res.status(404).json({ success: false, message: '记录不存在或无权操作' });
    }

    const { error } = await supabase.from('sijicihui').delete().eq('id', String(id)).eq('user_id', userId);
    if (error) {
      console.error('[Sijicihui] 删除失败:', error.message);
      return res.status(500).json({ success: false, message: '删除失败: ' + error.message });
    }
    return res.json({ success: true });
  } catch (error: any) {
    console.error('[Sijicihui] 删除异常:', error.message);
    res.status(500).json({ success: false, message: '删除失败: ' + error.message });
  }
};

router.get('/', authMiddleware, list);
router.post('/', authMiddleware, create);
router.put('/:id', authMiddleware, update);
router.delete('/:id', authMiddleware, remove);

export default router;