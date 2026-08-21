import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';

const router = Router();

// 获取显示设置
router.get('/display', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: '未登录' });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('user_settings')
      .select('display_settings')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // 返回默认设置
      return res.json({
        success: true,
        data: {
          fontSize: 'medium',
          theme: 'system',
          autoPlayAudio: true,
          showPhonetic: true,
          showExample: true,
        },
      });
    }

    res.json({ success: true, data: data.display_settings || {} });
  } catch (error) {
    console.error('获取显示设置失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 更新显示设置
router.post('/display', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: '未登录' });
    }

    const { fontSize, theme, autoPlayAudio, showPhonetic, showExample } = req.body;

    const supabase = getSupabaseClient();
    
    // 检查是否已存在设置
    const { data: existing } = await supabase
      .from('user_settings')
      .select('id')
      .eq('user_id', userId)
      .single();

    const displaySettings = {
      fontSize: fontSize || 'medium',
      theme: theme || 'system',
      autoPlayAudio: autoPlayAudio !== undefined ? autoPlayAudio : true,
      showPhonetic: showPhonetic !== undefined ? showPhonetic : true,
      showExample: showExample !== undefined ? showExample : true,
    };

    if (existing) {
      // 更新现有设置
      const { error } = await supabase
        .from('user_settings')
        .update({
          display_settings: displaySettings,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) throw error;
    } else {
      // 创建新设置
      const { error } = await supabase
        .from('user_settings')
        .insert({
          user_id: userId,
          display_settings: displaySettings,
          notification_settings: {
            pushEnabled: true,
            studyReminder: true,
            achievementNotification: true,
            systemNotification: true,
          },
        });

      if (error) throw error;
    }

    res.json({ success: true, data: displaySettings });
  } catch (error) {
    console.error('更新显示设置失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

export default router;
