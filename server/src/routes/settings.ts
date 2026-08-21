import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { getSupabaseClient } from '../storage/database/supabase-client';

const router = Router();

// 获取显示设置
router.get('/display', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: '未登录' });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('user_profiles')
      .select('display_settings')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('获取显示设置失败:', error);
      return res.status(500).json({ success: false, message: '获取设置失败' });
    }

    const settings = data?.display_settings || {
      fontSize: 'medium',
      theme: 'system',
      autoPlayAudio: true,
      showPhonetic: true,
      showExample: true,
    };

    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('获取显示设置失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 更新显示设置
router.post('/display', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: '未登录' });
    }

    const { fontSize, theme, autoPlayAudio, showPhonetic, showExample } = req.body;

    const supabase = getSupabaseClient();
    const displaySettings = {
      fontSize: fontSize || 'medium',
      theme: theme || 'system',
      autoPlayAudio: autoPlayAudio !== undefined ? autoPlayAudio : true,
      showPhonetic: showPhonetic !== undefined ? showPhonetic : true,
      showExample: showExample !== undefined ? showExample : true,
    };

    const { data, error } = await supabase
      .from('user_profiles')
      .update({ display_settings: displaySettings })
      .eq('user_id', userId)
      .select('display_settings')
      .single();

    if (error) {
      console.error('更新显示设置失败:', error);
      return res.status(500).json({ success: false, message: '更新设置失败' });
    }

    res.json({ success: true, data: data?.display_settings });
  } catch (error) {
    console.error('更新显示设置失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取通知设置
router.get('/notification-settings', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: '未登录' });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('user_profiles')
      .select('notification_settings')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('获取通知设置失败:', error);
      return res.status(500).json({ success: false, message: '获取设置失败' });
    }

    const settings = data?.notification_settings || {
      pushEnabled: true,
      studyReminder: true,
      achievementNotification: true,
      systemNotification: true,
    };

    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('获取通知设置失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 更新通知设置
router.post('/notification-settings', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: '未登录' });
    }

    const { pushEnabled, studyReminder, achievementNotification, systemNotification } = req.body;

    const supabase = getSupabaseClient();
    const notificationSettings = {
      pushEnabled: pushEnabled !== undefined ? pushEnabled : true,
      studyReminder: studyReminder !== undefined ? studyReminder : true,
      achievementNotification: achievementNotification !== undefined ? achievementNotification : true,
      systemNotification: systemNotification !== undefined ? systemNotification : true,
    };

    const { data, error } = await supabase
      .from('user_profiles')
      .update({ notification_settings: notificationSettings })
      .eq('user_id', userId)
      .select('notification_settings')
      .single();

    if (error) {
      console.error('更新通知设置失败:', error);
      return res.status(500).json({ success: false, message: '更新设置失败' });
    }

    res.json({ success: true, data: data?.notification_settings });
  } catch (error) {
    console.error('更新通知设置失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

export default router;
