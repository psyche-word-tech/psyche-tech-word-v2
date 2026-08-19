import { Router } from 'express';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { sendSmsCode } from '@/utils/sms';
import bcrypt from 'bcryptjs';

const router = Router();
const SALT_ROUNDS = 10;

// 内存验证码存储（当数据库表不存在时的 fallback）
const CODE_EXPIRY_MS = 5 * 60 * 1000; // 5分钟
const verificationCodeStore = new Map<string, { code: string; expiresAt: number }>();

function saveVerificationCode(phone: string, code: string) {
  verificationCodeStore.set(phone, { code, expiresAt: Date.now() + CODE_EXPIRY_MS });
}

function getVerificationCode(phone: string, code: string) {
  const record = verificationCodeStore.get(phone);
  if (!record) return null;
  if (record.code !== code) return null;
  if (Date.now() > record.expiresAt) {
    verificationCodeStore.delete(phone);
    return null;
  }
  return record;
}

function deleteVerificationCode(phone: string) {
  verificationCodeStore.delete(phone);
}

// 定期清理过期验证码
setInterval(() => {
  const now = Date.now();
  for (const [phone, record] of verificationCodeStore) {
    if (now > record.expiresAt) {
      verificationCodeStore.delete(phone);
    }
  }
}, 60 * 1000);

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

    const client = getSupabaseClient();

    // 先删除该手机号之前的验证码
    try {
      await client.from('verification_codes').delete().eq('phone', phone);
    } catch {
      // 表可能不存在，忽略
    }
    deleteVerificationCode(phone);

    // 本地生成6位数字验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 调用阿里云短信服务发送验证码
    const smsResult = await sendSmsCode(phone, code);

    if (!smsResult.success) {
      console.warn('短信服务发送失败（阿里云签名/模板未通过审核或配置有误）:', smsResult.error);
      // 短信发送失败时仍存储验证码，开发模式下前端可获取验证码进行测试
    }

    // 验证码5分钟有效
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS);

    // 尝试存储验证码到数据库
    let dbError: any = null;
    try {
      const { error } = await client.from('verification_codes').insert({
        phone,
        code,
        expires_at: expiresAt.toISOString(),
      });
      if (error) dbError = error;
    } catch (e) {
      dbError = e;
    }

    if (dbError) {
      console.warn('数据库存储验证码失败，使用内存存储:', dbError.message || dbError);
    }

    // 无论数据库存储是否成功，都保存到内存（确保可用）
    saveVerificationCode(phone, code);

    // 真实短信发送成功时不返回验证码（安全考虑）
    // 仅在短信服务异常时返回 code，方便开发调试
    const response: any = { success: true, message: '验证码已发送' };
    if (!smsResult.success) {
      response.code = code;
      response.smsWarning = smsResult.error;
    }
    res.json(response);
  } catch (error: any) {
    console.error('发送验证码异常:', error);
    res.json({ success: false, error: `发送失败: ${error?.message || String(error)}` });
  }
});

/**
 * POST /api/v1/auth/register
 * 注册
 */
router.post('/register', async (req, res) => {
  try {
    const { phone, password, code, role } = req.body;

    if (!phone || !password || !code) {
      return res.json({ success: false, error: '请填写完整信息' });
    }

    const client = getSupabaseClient();

    // 验证验证码（先查数据库，失败则查内存）
    let codeValid = false;
    try {
      const { data: codeData, error: codeError } = await client
        .from('verification_codes')
        .select('*')
        .eq('phone', phone)
        .eq('code', code)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1);
      if (!codeError && codeData && codeData.length > 0) {
        codeValid = true;
      }
    } catch {
      // 表可能不存在
    }

    if (!codeValid) {
      const memRecord = getVerificationCode(phone, code);
      if (!memRecord) {
        return res.json({ success: false, error: '验证码错误或已过期' });
      }
      codeValid = true;
    }

    // 检查手机号是否已注册
    const { data: userData } = await client
      .from('users')
      .select('id, password')
      .eq('phone', phone)
      .limit(1);

    // 密码加密
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // 如果用户已存在但未设置密码（通过短信登录创建），设置密码
    if (userData && userData.length > 0) {
      if (!userData[0].password) {
        const { error: updateError } = await client
          .from('users')
          .update({ password: hashedPassword })
          .eq('id', userData[0].id);
        
        if (updateError) {
          console.error('设置密码失败:', updateError);
          return res.json({ success: false, error: '设置密码失败' });
        }

        // 更新或创建用户资料（角色）
        const userRole = role === 'teacher' ? 'teacher' : 'student';
        await client.from('user_profiles').upsert({
          id: userData[0].id,
          role: userRole,
        }, { onConflict: 'id' });

        res.json({ 
          success: true, 
          message: '密码设置成功', 
          user: { id: userData[0].id, phone, role: userRole } 
        });
        return;
      }
      return res.json({ success: false, error: '该手机号已注册' });
    }

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

    // 创建用户资料记录（包含角色）
    const userRole = role === 'teacher' ? 'teacher' : 'student';
    await client.from('user_profiles').insert({
      id: newUser[0].id,
      role: userRole,
    });

    // 删除已使用的验证码
    try {
      await client.from('verification_codes').delete().eq('phone', phone);
    } catch {
      // 忽略
    }
    deleteVerificationCode(phone);

    res.json({ 
      success: true, 
      message: '注册成功', 
      user: { ...newUser[0], role: userRole } 
    });
  } catch (error: any) {
    console.error('注册异常:', error);
    res.json({ success: false, error: `注册异常: ${error?.message || String(error)}` });
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

    // 如果用户没有设置密码（通过短信登录创建的），提示使用验证码登录
    if (!user.password) {
      return res.json({ success: false, error: '该账号未设置密码，请使用验证码登录' });
    }

    // 兼容旧数据：password 可能是 JSON 对象格式
    let storedPassword = user.password;
    if (storedPassword && typeof storedPassword === 'object' && storedPassword.hash) {
      storedPassword = storedPassword.hash;
    } else if (typeof storedPassword === 'string') {
      try {
        const parsed = JSON.parse(storedPassword);
        if (parsed && parsed.hash) {
          storedPassword = parsed.hash;
        }
      } catch {
        // 正常 bcrypt hash 字符串，无需解析
      }
    }

    // 验证密码
    let isPasswordValid = false;
    try {
      if (typeof storedPassword === 'string' && storedPassword.startsWith('$2')) {
        isPasswordValid = await bcrypt.compare(password, storedPassword);
      } else {
        isPasswordValid = storedPassword === password;
      }
    } catch {
      isPasswordValid = storedPassword === password;
    }

    if (!isPasswordValid) {
      return res.json({ success: false, error: '用户名或密码错误' });
    }

    // 生成token（简化版，实际应使用JWT）
    const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');

    res.json({
      success: true,
      message: '登录成功',
      token,
      user: { id: user.id, phone: user.phone, username: user.username },
    });
  } catch (error: any) {
    console.error('密码登录异常:', error);
    res.json({ success: false, error: `登录异常: ${error?.message || String(error)}` });
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

    // 验证验证码（先查数据库，失败则查内存）
    let codeValid = false;
    try {
      const { data: codeData, error: codeError } = await client
        .from('verification_codes')
        .select('*')
        .eq('phone', phone)
        .eq('code', code)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1);
      if (!codeError && codeData && codeData.length > 0) {
        codeValid = true;
      }
    } catch {
      // 表可能不存在
    }

    if (!codeValid) {
      const memRecord = getVerificationCode(phone, code);
      if (!memRecord) {
        return res.json({ success: false, error: '验证码错误或已过期' });
      }
      codeValid = true;
    }

    // 查询或创建用户
    const { data: existingUsers, error: queryError } = await client
      .from('users')
      .select('id, phone, username')
      .eq('phone', phone)
      .limit(1);

    if (queryError) {
      console.error('查询用户失败:', queryError);
      return res.json({ success: false, error: `查询用户失败: ${queryError.message}` });
    }

    let user;
    if (existingUsers && existingUsers.length > 0) {
      user = existingUsers[0];
    } else {
      // 自动注册（手机号已验证，直接创建账号）
      const { data: newUsers, error: insertError } = await client
        .from('users')
        .insert({ phone })
        .select('id, phone, username')
        .limit(1);

      if (insertError) {
        console.error('创建用户失败:', insertError);
        return res.json({ success: false, error: `创建用户失败: ${insertError.message}` });
      }

      if (!newUsers || newUsers.length === 0) {
        return res.json({ success: false, error: '创建用户失败: 无返回数据' });
      }

      user = newUsers[0];
    }

    // 删除已使用的验证码
    try {
      await client.from('verification_codes').delete().eq('phone', phone);
    } catch {
      // 忽略
    }
    deleteVerificationCode(phone);

    // 生成token
    const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');

    res.json({
      success: true,
      message: '登录成功',
      token,
      user: { id: user.id, phone: user.phone, username: user.username },
    });
  } catch (error: any) {
    console.error('登录异常:', error);
    res.json({ success: false, error: `登录异常: ${error?.message || String(error)}` });
  }
});

/**
 * POST /api/v1/auth/delete-account
 * 注销账号
 */
router.post('/delete-account', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.json({ success: false, error: '用户ID不能为空' });
    }

    const client = getSupabaseClient();

    // 删除用户资料
    try {
      await client.from('user_profiles').delete().eq('id', userId);
    } catch {
      // 表可能不存在，忽略
    }

    // 删除用户
    const { error } = await client.from('users').delete().eq('id', userId);

    if (error) {
      console.error('删除用户失败:', error);
      return res.json({ success: false, error: '注销失败' });
    }

    res.json({ success: true, message: '账号已注销' });
  } catch (error: any) {
    console.error('注销账号异常:', error);
    res.json({ success: false, error: `注销异常: ${error?.message || String(error)}` });
  }
});

export default router;
