import { Router } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { authMiddleware } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';

const router = Router();

const supabase = getSupabaseClient();

// 获取某个单词的评论列表（只返回当前用户的评论）
router.get('/:wordId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { wordId } = req.params;
    const userId = req.userId;

    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('word_id', wordId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Failed to fetch comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// 创建评论（带上 user_id）
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { wordId, wordText, userName, content } = req.body;
    const userId = req.userId;

    if (!wordId || !content) {
      return res.status(400).json({ error: 'wordId and content are required' });
    }

    const { data, error } = await supabase
      .from('comments')
      .insert({
        word_id: wordId,
        word_text: wordText || '',
        user_name: userName || '匿名用户',
        content: content,
        user_id: userId,
      })
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    console.error('Failed to create comment:', error);
    const message = error?.message || error?.error_description || 'Failed to create comment';
    res.status(500).json({ error: message });
  }
});

// 删除评论（只能删除自己的评论）
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({ success: true, message: '评论已删除' });
  } catch (error) {
    console.error('Failed to delete comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

export default router;
