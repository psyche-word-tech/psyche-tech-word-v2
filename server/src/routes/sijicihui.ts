import { Router, type Request, type Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client.js';

const router = Router();

// 全局共享四级词库查询（不分用户），支持关键词搜索与分页
const list = async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    const q = req.query as Record<string, string | undefined>;
    const keyword = (q.keyword ?? '').trim();
    const page = Math.max(1, parseInt(q.page ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? '20', 10) || 20));
    const fromOffset = (page - 1) * limit;

    let query = supabase.from('sijicihui').select('id, word, phonetic, meaning', { count: 'exact' });

    // 单词前缀优先；无 prefix 匹配时按释义模糊
    query = query.ilike('word', `${keyword}%`);

    const { data, error, count } = await query.range(fromOffset, fromOffset + limit - 1);
    if (error) {
      console.error('[Sijicihui] 查询失败:', error.message);
      return res.status(500).json({ success: false, message: '查询失败: ' + error.message });
    }
    return res.json({
      success: true,
      count: count ?? 0,
      page,
      limit,
      data: data ?? [],
    });
  } catch (error: any) {
    console.error('[Sijicihui] 查询异常:', error.message);
    res.status(500).json({ success: false, message: '查询失败: ' + error.message });
  }
};

router.get('/', list);

export default router;