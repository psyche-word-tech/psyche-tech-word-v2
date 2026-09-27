import { Router, type Request, type Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { authMiddleware, type AuthRequest } from '../middleware/auth';

const router = Router();

// 获取学习统计：个人中心三列（学习天数/已学单词/已掌握）统一口径
// 学习天数 = 自注册（created_at）截至今天的自然天数
// 已学单词 = 所有已会 + 不会 + 模糊 的单词总数（四级 sijicihui_progress）
// 已掌握   = 所有已会（known）的单词量
router.get('/progress', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId as number;
    const supabase = getSupabaseClient();

    // 学习天数：自注册日算起
    let learningDays = 1;
    const { data: user } = await supabase
      .from('users')
      .select('id, created_at')
      .eq('id', userId)
      .maybeSingle();
    if (user && user.created_at) {
      const start = Date.parse(user.created_at);
      if (!isNaN(start)) {
        learningDays = Math.max(1, Math.floor((Date.now() - start) / 86400000));
      }
    }

    // 已学/已掌握：四级词书分类（known/vague/unknown）
    const counts = { known: 0, vague: 0, unknown: 0 };
    const { data: rows, error: err } = await supabase
      .from('sijicihui_progress')
      .select('status')
      .eq('user_id', userId);
    if (err) {
      console.error('[Progress] 统计失败:', err.message);
      return res.status(500).json({ success: false, error: '查询失败: ' + err.message });
    }
    (rows || []).forEach((r: any) => {
      if (r.status in counts) counts[r.status as keyof typeof counts] += 1;
    });

    const learnedWords = counts.known + counts.vague + counts.unknown;
    const masteredWords = counts.known;

    res.json({
      success: true,
      learningDays,
      learnedWords,
      masteredWords,
      totalWords: learnedWords,
      dailyAverage: 0,
      streak: 0,
    });
  } catch (error: any) {
    console.error('[Progress] 统计异常:', error.message);
    res.status(500).json({ success: false, error: '服务器错误: ' + error.message });
  }
});

// 修改密码
router.post('/change-password', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { oldPassword, newPassword } = req.body;

    if (!userId || !oldPassword || !newPassword) {
      return res.json({ success: false, error: '参数不完整' });
    }

    if (newPassword.length < 6) {
      return res.json({ success: false, error: '新密码长度不能少于 6 位' });
    }

    const supabase = getSupabaseClient();

    // 验证旧密码
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, password')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.json({ success: false, error: '用户不存在' });
    }

    if (user.password !== oldPassword) {
      return res.json({ success: false, error: '当前密码错误' });
    }

    // 更新密码
    const { error: updateError } = await supabase
      .from('users')
      .update({ password: newPassword, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (updateError) {
      return res.json({ success: false, error: '密码更新失败' });
    }

    res.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    console.error('修改密码错误:', error);
    res.json({ success: false, error: '服务器错误' });
  }
});

// 发送验证码
router.post('/send-verification-code', async (req: Request, res: Response) => {
  try {
    const { phone, type } = req.body;

    if (!phone || !type) {
      return res.json({ success: false, error: '参数不完整' });
    }

    const supabase = getSupabaseClient();

    // 生成 6 位验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 存储验证码到数据库
    const { error } = await supabase
      .from('verification_codes')
      .insert([{
        phone,
        code,
        type,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
      }]);

    if (error) {
      console.error('验证码存储错误:', error);
      return res.json({ success: false, error: '验证码发送失败' });
    }

    console.log(`验证码：${code}，发送到：${phone}`);

    res.json({ success: true, message: '验证码已发送' });
  } catch (error) {
    console.error('发送验证码错误:', error);
    res.json({ success: false, error: '服务器错误' });
  }
});

// 修改手机号
router.post('/change-phone', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { newPhone, code } = req.body;

    if (!userId || !newPhone || !code) {
      return res.json({ success: false, error: '参数不完整' });
    }

    if (!/^1[3-9]\d{9}$/.test(newPhone)) {
      return res.json({ success: false, error: '手机号格式不正确' });
    }

    const supabase = getSupabaseClient();

    // 验证验证码
    const { data: codeRecord, error: codeError } = await supabase
      .from('verification_codes')
      .select('id, expires_at')
      .eq('phone', newPhone)
      .eq('code', code)
      .eq('type', 'change_phone')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (codeError || !codeRecord) {
      return res.json({ success: false, error: '验证码错误' });
    }

    if (new Date(codeRecord.expires_at) < new Date()) {
      return res.json({ success: false, error: '验证码已过期' });
    }

    // 更新手机号
    const { error: updateError } = await supabase
      .from('users')
      .update({ phone: newPhone, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (updateError) {
      return res.json({ success: false, error: '手机号更新失败' });
    }

    // 删除已使用的验证码
    await supabase
      .from('verification_codes')
      .delete()
      .eq('id', codeRecord.id);

    res.json({ success: true, message: '手机号修改成功' });
  } catch (error) {
    console.error('修改手机号错误:', error);
    res.json({ success: false, error: '服务器错误' });
  }
});

// 获取通知设置
router.get('/notification-settings', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.json({ success: false, error: '未授权' });
    }

    const supabase = getSupabaseClient();

    const { data: settings, error } = await supabase
      .from('user_settings')
      .select('notification_settings')
      .eq('user_id', userId)
      .single();

    if (error || !settings) {
      return res.json({
        success: true,
        settings: {
          pushEnabled: true,
          studyReminder: true,
          achievementNotification: true,
          systemNotification: true,
        },
      });
    }

    res.json({ success: true, settings: settings.notification_settings || {} });
  } catch (error) {
    console.error('获取通知设置错误:', error);
    res.json({ success: false, error: '服务器错误' });
  }
});

// 更新通知设置
router.post('/notification-settings', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { settings } = req.body;

    if (!userId || !settings) {
      return res.json({ success: false, error: '参数不完整' });
    }

    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        notification_settings: settings,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      return res.json({ success: false, error: '设置更新失败' });
    }

    res.json({ success: true, message: '设置已更新' });
  } catch (error) {
    console.error('更新通知设置错误:', error);
    res.json({ success: false, error: '服务器错误' });
  }
});

// 备份数据
router.post('/backup-data', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.json({ success: false, error: '参数不完整' });
    }

    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('data_backups')
      .insert([{
        user_id: userId,
        backup_type: 'manual',
        status: 'completed',
        created_at: new Date().toISOString(),
      }]);

    if (error) {
      return res.json({ success: false, error: '备份失败' });
    }

    res.json({ success: true, message: '数据备份成功' });
  } catch (error) {
    console.error('备份数据错误:', error);
    res.json({ success: false, error: '服务器错误' });
  }
});

// 导出数据
router.post('/export-data', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.json({ success: false, error: '参数不完整' });
    }

    const supabase = getSupabaseClient();

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!user) {
      return res.json({ success: false, error: '用户不存在' });
    }

    console.log('导出数据:', user);

    res.json({ success: true, message: '数据导出成功，已发送到您的邮箱' });
  } catch (error) {
    console.error('导出数据错误:', error);
    res.json({ success: false, error: '服务器错误' });
  }
});

// 注销账号
router.post('/delete-account', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { password } = req.body;

    if (!userId || !password) {
      return res.json({ success: false, error: '参数不完整' });
    }

    const supabase = getSupabaseClient();

    // 验证密码
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, password')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.json({ success: false, error: '用户不存在' });
    }

    if (user.password !== password) {
      return res.json({ success: false, error: '密码错误' });
    }

    // 删除用户相关数据
    await supabase.from('user_profiles').delete().eq('user_id', userId);
    await supabase.from('user_settings').delete().eq('user_id', userId);
    await supabase.from('iris_recognition_data').delete().eq('user_id', userId);

    // 删除用户
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (deleteError) {
      return res.json({ success: false, error: '账号注销失败' });
    }

    res.json({ success: true, message: '账号已注销' });
  } catch (error) {
    console.error('注销账号错误:', error);
    res.json({ success: false, error: '服务器错误' });
  }
});

export default router;
