import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { getSupabaseClient } from '../storage/database/supabase-client.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { extractQuestionFromImage } from '../services/question-ocr.js';
import { createHash } from 'crypto';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

function imageHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex').slice(0, 32);
}

// 收藏题目：支持两种方式
// 1) JSON：传 question_text 等已解析文字 + image_url（前端搜题已拿到文字时）
// 2) FormData：传 image 原图，后端后台调大模型转成文字题干后入库
const handleJson = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const supabase = getSupabaseClient();

    if (!req.body || !req.body.question_text) {
      return res.status(400).json({ success: false, message: '题目内容不能为空' });
    }

    const { question_text, subject, answer, analysis, solution, tips, image_url } = req.body;

    const { data, error } = await supabase
      .from('favorites')
      .insert({
        user_id: userId,
        question_text,
        subject: subject || '未知',
        answer: answer || '',
        analysis: analysis || '',
        solution: solution || '',
        tips: tips || '',
        image_url: image_url || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[Favorites] 收藏入库失败:', error.message);
      return res.status(500).json({ success: false, message: '收藏失败: ' + error.message });
    }
    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('[Favorites] 收藏接口错误:', error.message);
    res.status(500).json({ success: false, message: '收藏失败: ' + error.message });
  }
};

const handleImage = upload.single('image');

const handleFavoritePost = async (req: AuthRequest, res: Response) => {
  // 依据 content-type 走不同处理
  const ct = (req.headers['content-type'] || '').toLowerCase();
  if (ct.includes('multipart/form-data')) {
    return new Promise<void>((resolve) => {
      (handleImage as any)(req, res, (err?: Error) => {
        if (err) {
          console.error('[Favorites] 上传解析失败:', err.message);
          res.status(400).json({ success: false, message: '上传解析失败: ' + err.message });
          return resolve();
        }
        void handleImageSubmit(req, res).finally(() => resolve());
      });
    });
  }
  return handleJson(req, res);
};

const handleImageSubmit = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const supabase = getSupabaseClient();

    if (!req.file) {
      return res.status(400).json({ success: false, message: '缺少图片' });
    }

    const hash = imageHash(req.file.buffer);
    const { data: dup } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('image_hash', hash)
      .limit(1);
    if (dup && dup.length > 0) {
      return res.json({ success: true, message: '已在收藏夹中', isFavorite: true, data: dup[0] });
    }

    // 后台调大模型把图转成文字题干；失败时降级为仅存图片、文字留空
    let ocr;
    try {
      ocr = await extractQuestionFromImage(req.file.buffer);
    } catch (ocrErr: any) {
      console.warn('[Favorites] 题目识别失败，降级仅存图片:', ocrErr.message);
      ocr = { question: '', subject: '', answer: '', analysis: '', solution: '', tips: '' };
    }
    const { data, error } = await supabase
      .from('favorites')
      .insert({
        user_id: userId,
        question_text: ocr.question || '',
        subject: ocr.subject || '未知',
        answer: ocr.answer || '',
        analysis: ocr.analysis || '',
        solution: ocr.solution || '',
        tips: ocr.tips || '',
        image_url: req.body.image_url || null,
        image_hash: hash,
      })
      .select()
      .single();
    if (error) {
      console.error('[Favorites] 收藏入库失败（图片）:', error.message);
      return res.status(500).json({ success: false, message: '收藏失败: ' + error.message });
    }
    const dataWithWarn = ocr.question ? data : { ...data, warn: '题目文字识别失败，仅保存了原图' };
    return res.json({ success: true, data: dataWithWarn });
  } catch (error: any) {
    console.error('[Favorites] 收藏接口错误:', error.message);
    res.status(500).json({ success: false, message: '收藏失败: ' + error.message });
  }
};

router.post('/', authMiddleware, (req, res) => {
  void handleFavoritePost(req, res);
});

// 取消收藏
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const supabase = getSupabaseClient();

    const { data: existing } = await supabase
      .from('favorites')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', userId)
      .single();

    if (!existing) {
      return res.json({ success: false, message: '收藏不存在' });
    }

    const { error } = await supabase.from('favorites').delete().eq('id', req.params.id);
    if (error) {
      console.error('[Favorites] 取消收藏失败:', error.message);
      return res.status(500).json({ success: false, message: '取消收藏失败' });
    }
    res.json({ success: true, message: '已取消收藏' });
  } catch (error: any) {
    console.error('[Favorites] 取消收藏接口错误:', error.message);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取收藏列表
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('favorites')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Favorites] 获取收藏列表失败:', error.message);
      return res.status(500).json({ success: false, message: '获取收藏列表失败' });
    }
    res.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('[Favorites] 获取收藏列表接口错误:', error.message);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

export default router;