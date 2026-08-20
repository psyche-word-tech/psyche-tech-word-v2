import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// 获取虹膜识别状态
router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: '未登录' });
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('user_profiles')
      .select('iris_enabled')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Get iris status error:', error);
      return res.status(500).json({ success: false, error: '查询失败' });
    }

    res.json({ success: true, enabled: data?.iris_enabled || false });
  } catch (error) {
    console.error('Get iris status error:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// 开通/关闭虹膜识别
router.post('/enable', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { enabled } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: '未登录' });
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('user_profiles')
      .update({ iris_enabled: enabled })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Update iris status error:', error);
      return res.status(500).json({ success: false, error: '更新失败' });
    }

    res.json({ success: true, enabled: data?.iris_enabled || false });
  } catch (error) {
    console.error('Update iris status error:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// 保存虹膜识别数据
router.post('/iris-data', async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId, emotion, focusScore, gazeDirection, difficultyReaction } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: '未登录' });
    }

    if (!sessionId) {
      return res.status(400).json({ success: false, error: '缺少 sessionId' });
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('iris_recognition_data')
      .insert({
        user_id: userId,
        session_id: sessionId,
        emotion: emotion || 'neutral',
        focus_score: focusScore || 0,
        gaze_direction: gazeDirection || 'center',
        difficulty_reaction: difficultyReaction || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Save iris data error:', error);
      return res.status(500).json({ success: false, error: '保存失败' });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Save iris data error:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// 获取用户的虹膜识别数据
router.get('/iris-data', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { sessionId, limit = 100 } = req.query;

    if (!userId) {
      return res.status(401).json({ success: false, error: '未登录' });
    }

    const client = getSupabaseClient();
    let query = client
      .from('iris_recognition_data')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(Number(limit));

    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Get iris data error:', error);
      return res.status(500).json({ success: false, error: '查询失败' });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get iris data error:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// 获取专注度统计
router.get('/iris-stats', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: '未登录' });
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('iris_recognition_data')
      .select('focus_score, emotion')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(1000);

    if (error) {
      console.error('Get iris stats error:', error);
      return res.status(500).json({ success: false, error: '查询失败' });
    }

    if (!data || data.length === 0) {
      return res.json({
        success: true,
        data: {
          averageFocus: 0,
          emotionDistribution: {},
          totalRecords: 0,
        },
      });
    }

    const averageFocus = data.reduce((sum, item) => sum + (item.focus_score || 0), 0) / data.length;
    
    const emotionDistribution: Record<string, number> = {};
    data.forEach(item => {
      const emotion = item.emotion || 'neutral';
      emotionDistribution[emotion] = (emotionDistribution[emotion] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        averageFocus: Math.round(averageFocus),
        emotionDistribution,
        totalRecords: data.length,
      },
    });
  } catch (error) {
    console.error('Get iris stats error:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

export default router;
