import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// 创建 Supabase 客户端
function getSupabaseClient() {
  const url = process.env.COZE_SUPABASE_URL || 'https://hmkkynldaiypuhhlpjxd.supabase.co';
  const key = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.COZE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhta2t5bmxkYWl5cHVoaGxwanhkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAyNTQxMywiZXhwIjoyMDkyNjAxNDEzfQ.lDYVf0H2OK_Z7nmDYybHC93DtDroD5m8eRJpE25776o';
  return createClient(url, key);
}

// 收藏题目
router.post('/', async (req: Request, res: Response) => {
  try {
    const { problemId, questionText, subject, answer, analysis, solution, tips, imageUrl } = req.body;

    if (!questionText) {
      return res.status(400).json({ success: false, message: '题目内容不能为空' });
    }

    const supabase = getSupabaseClient();
    
    // 检查是否已收藏
    if (problemId) {
      const { data: exists } = await supabase.rpc('check_favorite', {
        p_problem_id: problemId,
        p_user_id: 'default_user'
      });

      if (exists) {
        return res.json({ success: true, message: '已在收藏夹中', isFavorite: true });
      }
    }

    // 使用 SQL 函数插入收藏
    const { data, error } = await supabase.rpc('add_favorite', {
      p_user_id: 'default_user',
      p_problem_id: problemId || null,
      p_question_text: questionText,
      p_subject: subject || '未知',
      p_answer: answer || '',
      p_analysis: analysis || '',
      p_solution: solution || '',
      p_tips: tips || '',
      p_image_url: imageUrl || null
    });

    if (error) {
      console.error('收藏失败:', error);
      return res.status(500).json({ success: false, message: '收藏失败: ' + error.message });
    }

    res.json({ success: true, data, isFavorite: true });
  } catch (error) {
    console.error('收藏接口错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 取消收藏
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseClient();

    const { data: deleted, error } = await supabase.rpc('delete_favorite', {
      p_id: id,
      p_user_id: 'default_user'
    });

    if (error) {
      console.error('取消收藏失败:', error);
      return res.status(500).json({ success: false, message: '取消收藏失败' });
    }

    res.json({ success: deleted, message: deleted ? '已取消收藏' : '收藏不存在' });
  } catch (error) {
    console.error('取消收藏接口错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取收藏列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.rpc('get_favorites', {
      p_user_id: 'default_user'
    });

    if (error) {
      console.error('获取收藏列表失败:', error);
      return res.status(500).json({ success: false, message: '获取收藏列表失败' });
    }

    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('获取收藏列表接口错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 检查是否已收藏
router.get('/check/:problemId', async (req: Request, res: Response) => {
  try {
    const { problemId } = req.params;
    const supabase = getSupabaseClient();

    const { data: exists, error } = await supabase.rpc('check_favorite', {
      p_problem_id: problemId,
      p_user_id: 'default_user'
    });

    if (error) {
      console.error('检查收藏状态失败:', error);
      return res.status(500).json({ success: false, message: '检查收藏状态失败' });
    }

    res.json({ success: true, isFavorite: exists || false });
  } catch (error) {
    console.error('检查收藏状态接口错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

export default router;
