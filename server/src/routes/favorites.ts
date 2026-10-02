import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { getSupabaseClient } from '../storage/database/supabase-client.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { extractQuestionFromImage } from '../services/question-ocr.js';
import { createHash } from 'crypto';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';

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

// 导出错题训练材料（docx）：题干含完整原文语境（保证能推出答案），每题附正确答案/错因/知识点
// groupBy：none=平铺；subject=按学科；knowledge=按知识点；competency=按核心素养
function buildTrainDocx(rows: any[], userName: string, groupBy: string = 'none'): any {
  const P = (t: string, bold = false, size = 22) => new Paragraph({
    children: [new TextRun({ text: t, bold, size })],
    spacing: { after: 120 },
  });
  const H1 = (t: string) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: t })] });
  const H2 = (t: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: t })] });
  const bullets: any[] = [];
  const strip = (t: string) => String(t || '').replace(/<[^>]*>/g, '').replace(/\\\(|\\\[|\\\)|\\\]/g, '');

  // 解析每题的 tips 与分组键
  const items = rows.map((r) => {
    let tip: any = {};
    try { tip = JSON.parse(r.tips || '{}'); } catch { /* ignore */ }
    const status = String(tip.status || '');
    const statusLabel = status === 'correct' ? '正确' : status === 'attention' ? '重点' : status === 'blank' ? '未答' : '错误';
    let group: string;
    if (groupBy === 'subject') group = r.subject || '其他';
    else if (groupBy === 'knowledge') group = tip.knowledge_point || '未分类';
    else if (groupBy === 'competency') group = tip.core_competency || '未分类';
    else group = '__all__';
    return { r, tip, statusLabel, group };
  });

  const appendQuestion = (it: any, globalIdx: number) => {
    const { r, tip, statusLabel } = it;
    bullets.push(H2(`第 ${globalIdx} 题${r.subject ? '　【' + r.subject + '】' : ''}`));
    bullets.push(P('【题干】', true, 24));
    bullets.push(P(strip(r.question_text)));
    if (tip.user_answer) bullets.push(P(`我的答案：${strip(tip.user_answer)}`, false, 22));
    bullets.push(P(`作答状态：${statusLabel}`, false, 22));
    bullets.push(P(''));
    bullets.push(P('【答案与解析】', true, 24));
    if (r.answer) bullets.push(P(`正确答案：${strip(r.answer)}`, false, 22));
    if (tip.knowledge_point) bullets.push(P(`知识点：${strip(tip.knowledge_point)}`, false, 22));
    if (tip.core_competency) bullets.push(P(`学科核心素养：${strip(tip.core_competency)}`, false, 22));
    if (tip.difficulty) bullets.push(P(`难度：${strip(tip.difficulty)}`, false, 22));
    if (r.analysis) bullets.push(P(`错因 / 要点：${strip(r.analysis)}`, false, 22));
    bullets.push(P(''));
  };

  bullets.push(H1('错题训练'));
  bullets.push(P(`学生：${userName}    共 ${rows.length} 道错题    导出时间：${new Date().toLocaleString('zh-CN')}`, false, 22));
  bullets.push(P('提示：每题题干均保留完整原文语境，请先独立作答，再看下方“正确答案”。'));
  bullets.push(P(''));

  if (groupBy === 'none' || groupBy === '__all__') {
    items.forEach((it, i) => appendQuestion(it, i + 1));
  } else {
    // 保持出现顺序分组
    const order: string[] = [];
    const grouped: Record<string, typeof items> = {};
    items.forEach((it) => {
      if (!(it.group in grouped)) { grouped[it.group] = []; order.push(it.group); }
      grouped[it.group].push(it);
    });
    let globalIdx = 1;
    order.forEach((g, gi) => {
      const groupLabel = groupBy === 'subject' ? '学科' : groupBy === 'knowledge' ? '知识点' : '核心素养';
      bullets.push(H2(`${groupLabel}：${g}（${grouped[g].length} 题）`));
      grouped[g].forEach((it) => { appendQuestion(it, globalIdx); globalIdx += 1; });
    });
  }

  return new Document({ sections: [{ children: bullets }] });
}

// POST /api/v1/favorites/export —— 下载错题训练材料（docx）
router.post('/export', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('favorites')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Favorites] 导出读取失败:', error.message);
      return res.status(500).json({ success: false, message: '导出失败' });
    }

    // 导出错题（错误/重点/未答），正确题不纳入训练材料
    const rows = (data || []).filter((f) => {
      let t: any = {};
      try { t = JSON.parse(f.tips || '{}'); } catch { /* ignore */ }
      return t.status === 'wrong' || t.status === 'attention' || t.status === 'blank';
    });

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: '当前没有可导出的错题' });
    }

    const groupBy = ['subject', 'knowledge', 'competency'].includes(String(req.body?.groupBy))
      ? String(req.body?.groupBy)
      : 'none';
    const doc = buildTrainDocx(rows, '学生', groupBy);
    const buffer = await Packer.toBuffer(doc);
    const filename = `错题训练_${userId}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.end(Buffer.from(buffer));
  } catch (e: any) {
    console.error('[Favorites] 导出错题失败:', e.message);
    res.status(500).json({ success: false, message: '导出错题失败' });
  }
});

export default router;