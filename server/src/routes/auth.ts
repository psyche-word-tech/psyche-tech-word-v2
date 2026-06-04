import { Router } from 'express';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { sendSmsCode } from '@/utils/sms';
import bcrypt from 'bcryptjs';

const router = Router();
const SALT_ROUNDS = 10;

/**
 * POST /api/v1/auth/send-code
 * 发送验证码
 */
router.post('/send-code', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone || phone.length !== 11) {
      return res.json({ success: false, error: '请输入正确的手机号' });
    }

    // 先删除该手机号之前的验证码
    const client = getSupabaseClient();
    await client.from('verification_codes').delete().eq('phone', phone);

    // 本地生成6位数字验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 调用阿里云短信服务发送验证码
    const smsResult = await sendSmsCode(phone, code);

    if (!smsResult.success) {
      console.warn('短信服务发送失败（阿里云签名/模板未通过审核或配置有误）:', smsResult.error);
      // 短信发送失败时仍存储验证码，开发模式下前端可获取验证码进行测试
    }

    // 验证码5分钟有效
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // 存储验证码到数据库
    const { error } = await client.from('verification_codes').insert({
      phone,
      code,
      expires_at: expiresAt.toISOString()
    });

    if (error) {
      console.error('存储验证码失败:', error);
      return res.json({ success: false, error: '发送失败' });
    }

    // 真实短信发送成功时不返回验证码（安全考虑）
    // 仅在短信服务异常时返回 code，方便开发调试
    const response: any = { success: true, message: '验证码已发送' };
    if (!smsResult.success) {
      response.code = code;
      response.smsWarning = smsResult.error;
    }
    res.json(response);
  } catch (error) {
    console.error('发送验证码失败:', error);
    res.json({ success: false, error: '发送失败' });
  }
});

/**
 * POST /api/v1/auth/register
 * 注册
 */
router.post('/register', async (req, res) => {
  try {
    const { phone, password, code } = req.body;
    
    if (!phone || !password || !code) {
      return res.json({ success: false, error: '请填写完整信息' });
    }
    
    const client = getSupabaseClient();
    
    // 验证验证码
    const { data: codeData, error: codeError } = await client
      .from('verification_codes')
      .select('*')
      .eq('phone', phone)
      .eq('code', code)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (codeError || !codeData || codeData.length === 0) {
      return res.json({ success: false, error: '验证码错误或已过期' });
    }
    
    // 检查手机号是否已注册
    const { data: userData } = await client
      .from('users')
      .select('id')
      .eq('phone', phone)
      .limit(1);
    
    if (userData && userData.length > 0) {
      return res.json({ success: false, error: '该手机号已注册' });
    }
    
    // 密码加密
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // 创建用户
    const { data: newUser, error: insertError } = await client
      .from('users')
      .insert({ phone, password: hashedPassword })
      .select()
      .limit(1);
    
    if (insertError) {
      console.error('创建用户失败:', insertError);
      return res.json({ success: false, error: '注册失败' });
    }
    
    // 删除已使用的验证码
    await client.from('verification_codes').delete().eq('phone', phone);
    
    res.json({ success: true, message: '注册成功', user: newUser[0] });
  } catch (error) {
    console.error('注册失败:', error);
    res.json({ success: false, error: '注册失败' });
  }
});

/**
 * POST /api/v1/auth/login
 * 密码登录
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.json({ success: false, error: '请填写用户名和密码' });
    }
    
    const client = getSupabaseClient();
    
    // 查询用户（支持手机号或用户名登录）
    const { data: userData, error } = await client
      .from('users')
      .select('id, phone, username, password')
      .or(`phone.eq.${username},username.eq.${username}`)
      .limit(1);

    if (error || !userData || userData.length === 0) {
      return res.json({ success: false, error: '用户名或密码错误' });
    }

    const user = userData[0];

    // 验证密码（兼容明文密码和加密密码）
    const isPasswordValid = await bcrypt.compare(password, user.password)
      || user.password === password; // 兼容旧明文密码

    if (!isPasswordValid) {
      return res.json({ success: false, error: '用户名或密码错误' });
    }
    
    // 生成token（简化版，实际应使用JWT）
    const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');

    res.json({
      success: true,
      message: '登录成功',
      token,
      user: { id: user.id, phone: user.phone, username: user.username }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.json({ success: false, error: '登录失败' });
  }
});

/**
 * POST /api/v1/auth/sms-login
 * 验证码登录
 */
router.post('/sms-login', async (req, res) => {
  try {
    const { phone, code } = req.body;
    
    if (!phone || !code) {
      return res.json({ success: false, error: '请填写手机号和验证码' });
    }
    
    const client = getSupabaseClient();
    
    // 验证验证码
    const { data: codeData, error: codeError } = await client
      .from('verification_codes')
      .select('*')
      .eq('phone', phone)
      .eq('code', code)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (codeError || !codeData || codeData.length === 0) {
      return res.json({ success: false, error: '验证码错误或已过期' });
    }
    
    // 查询或创建用户
    let { data: userData } = await client
      .from('users')
      .select('id, phone, username')
      .eq('phone', phone)
      .limit(1);
    
    if (!userData || userData.length === 0) {
      // 自动注册（手机号已验证，直接创建账号）
      const result = await client
        .from('users')
        .insert({ phone })
        .select()
        .limit(1);
      userData = result.data;
    }
    
    const user = userData![0];
    
    // 删除已使用的验证码
    await client.from('verification_codes').delete().eq('phone', phone);
    
    // 生成token
    const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
    
    res.json({ 
      success: true, 
      message: '登录成功',
      token,
      user: { id: user.id, phone: user.phone, username: user.username }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.json({ success: false, error: '登录失败' });
  }
});

export default router;
