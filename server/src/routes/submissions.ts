import { Router } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';

const router = Router();

/**
 * 提交作业
 * POST /api/submissions
 */
router.post('/', async (req, res) => {
  try {
    const { image, type } = req.body;

    if (!image) {
      return res.status(400).json({ success: false, message: '缺少图片数据' });
    }

    const supabase = getSupabaseClient();

    // 将 base64 图片上传到 Supabase Storage
    const base64Data = image.split(',')[1] || image;
    const buffer = Buffer.from(base64Data, 'base64');
    const fileName = `submissions/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('submissions')
      .upload(fileName, buffer, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      console.error('上传失败:', uploadError);
      return res.status(500).json({ success: false, message: '图片上传失败' });
    }

    // 获取公开 URL
    const { data: urlData } = supabase.storage
      .from('submissions')
      .getPublicUrl(fileName);

    const imageUrl = urlData.publicUrl;

    // 插入数据库记录
    const { data, error } = await supabase
      .from('submissions')
      .insert({
        student_id: '00000000-0000-0000-0000-000000000000',
        image_url: imageUrl,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('插入失败:', error);
      return res.status(500).json({ success: false, message: '提交失败' });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('提交作业错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

/**
 * 获取提交列表
 * GET /api/submissions
 */
router.get('/', async (req, res) => {
  try {
    const { role } = req.query;
    const supabase = getSupabaseClient();

    let query = supabase.from('submissions').select('*');

    if (role === 'teacher') {
      query = query.order('created_at', { ascending: false });
    } else {
      query = query
        .eq('student_id', '00000000-0000-0000-0000-000000000000')
        .order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error('查询失败:', error);
      return res.status(500).json({ success: false, message: '查询失败' });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('获取列表错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

/**
 * 更新批改结果
 * PUT /api/submissions/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { grade, feedback, annotations, status } = req.body;
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('submissions')
      .update({
        grade,
        feedback,
        annotations: annotations ? JSON.stringify(annotations) : null,
        status: status || 'graded',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('更新失败:', error);
      return res.status(500).json({ success: false, message: '更新失败' });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('更新错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

/**
 * 获取单个提交详情
 * GET /api/submissions/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('查询失败:', error);
      return res.status(500).json({ success: false, message: '查询失败' });
    }

    if (!data) {
      return res.status(404).json({ success: false, message: '未找到记录' });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('查询错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

export default router;
