import { Router } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';
import type { AuthRequest } from '../middleware/auth';
import { optionalAuthMiddleware } from '../middleware/auth';

const router = Router();

const TEACHER_USER_ID = 116;
const CLASSES = ['318班', '201班'];

function isTeacher(req: AuthRequest) {
  return req.userId === TEACHER_USER_ID;
}

// 从 annotations(jsonb) 读取班级/姓名（零改表方案）
function getMeta(annotations: any) {
  if (annotations && typeof annotations === 'object' && !Array.isArray(annotations)) {
    return {
      className: String(annotations.className || ''),
      studentName: String(annotations.studentName || ''),
    };
  }
  return { className: '', studentName: '' };
}

/**
 * 提交作业
 * POST /api/v1/submissions
 * body: { image(base64), name, className, type }
 */
router.post('/', optionalAuthMiddleware, async (req: AuthRequest, res) => {
  try {
    const { image, name, className, type } = req.body;

    if (!image) {
      return res.status(400).json({ success: false, message: '缺少图片数据' });
    }

    if (name && !String(name).trim()) {
      return res.status(400).json({ success: false, message: '请填写姓名' });
    }

    const allowedClass = CLASSES.find((c) => c === className);
    if (!allowedClass) {
      return res.status(400).json({ success: false, message: '请选择班级' });
    }

    const supabase = getSupabaseClient();

    const base64Data = image.split(',')[1] || image;
    const buffer = Buffer.from(base64Data, 'base64');
    const fileName = `submissions/${Date.now()}-${Math.random().toString(36).substring(2, 11)}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('submissions')
      .upload(fileName, buffer, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      console.error('上传失败:', uploadError);
      return res.status(500).json({ success: false, message: '图片上传失败' });
    }

    const { data: urlData } = supabase.storage.from('submissions').getPublicUrl(fileName);
    const imageUrl = urlData.publicUrl;

    const studentId = '00000000-0000-0000-0000-000000000000';
    const meta: Record<string, any> = {
      className: allowedClass,
      studentName: String(name || '匿名').trim(),
    };
    if (req.userId) {
      meta.userId = req.userId;
    }
    const homeworkType = String(req.body.homeworkType || '').trim();
    if (homeworkType) {
      meta.homeworkType = homeworkType;
    }

    const { data, error } = await supabase
      .from('submissions')
      .insert({
        student_id: studentId,
        image_url: imageUrl,
        status: 'pending',
        annotations: meta,
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
 * 我的提交 / 老师全部
 * GET /api/v1/submissions?role=teacher
 */
router.get('/', optionalAuthMiddleware, async (req: AuthRequest, res) => {
  try {
    const { role } = req.query;
    const supabase = getSupabaseClient();

    let query = supabase.from('submissions').select('*');

    if (role === 'teacher') {
      if (!isTeacher(req)) {
        return res.status(403).json({ success: false, message: '无权限查看' });
      }
      query = query.order('created_at', { ascending: false });
    } else {
      // 学生「已提交」：按登录用户查自己的提交；无 userId 的匿名提交归到占位学生
      const key = req.userId ? String(req.userId) : '00000000-0000-0000-0000-000000000000';
      if (req.userId) {
        query = query.eq('annotations->>userId', key);
      } else {
        query = query.eq('student_id', '00000000-0000-0000-0000-000000000000');
      }
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;
    if (error) {
      console.error('查询失败:', error);
      return res.status(500).json({ success: false, message: '查询失败' });
    }

    const normalized = (data || []).map((s) => ({
      ...s,
      meta: getMeta(s.annotations),
    }));
    res.json({ success: true, data: normalized });
  } catch (error) {
    console.error('获取列表错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

/**
 * 班级作业列表（仅老师）
 * GET /api/v1/submissions/class/:className
 */
router.get('/class/:className', optionalAuthMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!isTeacher(req)) {
      return res.status(403).json({ success: false, message: '无权限查看' });
    }
    const className = String(req.params.className);
    if (!CLASSES.includes(className)) {
      return res.status(400).json({ success: false, message: '未知班级' });
    }

    const supabase = getSupabaseClient();
    let query = supabase
      .from('submissions')
      .select('*')
      .eq('annotations->>className', className);

    const type = String(req.query.type || '');
    if (type === '小作文' || type === '读后续写') {
      query = query.eq('annotations->>homeworkType', type);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('班级查询失败:', error);
      return res.status(500).json({ success: false, message: '查询失败' });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('班级查询错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

/**
 * 班级学情汇总（仅老师）
 * GET /api/v1/submissions/class/:className/summary
 */
router.get('/class/:className/summary', optionalAuthMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!isTeacher(req)) {
      return res.status(403).json({ success: false, message: '无权限查看' });
    }
    const className = String(req.params.className);
    if (!CLASSES.includes(className)) {
      return res.status(400).json({ success: false, message: '未知班级' });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('annotations->>className', className)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('汇总查询失败:', error);
      return res.status(500).json({ success: false, message: '查询失败' });
    }

    const rows = data || [];
    const total = rows.length;
    const pending = rows.filter((s) => s.status === 'pending').length;
    const graded = rows.filter((s) => s.status === 'graded').length;
    const studentsMap = new Map<string, number>();
    for (const s of rows) {
      const m = getMeta(s.annotations);
      const key = m.studentName || '匿名';
      studentsMap.set(key, (studentsMap.get(key) || 0) + 1);
    }
    const byStudent = Array.from(studentsMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    const latest = rows.length ? rows[rows.length - 1].created_at : null;

    res.json({
      success: true,
      data: {
        className,
        total,
        pending,
        graded,
        studentCount: byStudent.length,
        latestSubmittedAt: latest,
        byStudent,
      },
    });
  } catch (error) {
    console.error('汇总错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

/**
 * 更新批改结果（合并 annotations，保留 meta）
 * PUT /api/v1/submissions/:id
 */
/**
 * 删除单个提交（仅教师）
 * DELETE /api/v1/submissions/:id
 */
router.delete('/:id', optionalAuthMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!isTeacher(req)) {
      return res.status(403).json({ success: false, message: '无权限' });
    }
    const { id } = req.params;
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('submissions').delete().eq('id', id);
    if (error) {
      console.error('删除作业失败:', error);
      return res.status(500).json({ success: false, message: '删除失败' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('删除作业错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { grade, feedback, annotations, status } = req.body;
    const supabase = getSupabaseClient();

    const { data: existing } = await supabase.from('submissions').select('annotations').eq('id', id).single();
    const prev = getMeta(existing?.annotations);
    let mergedAnnotations: any = null;
    if (prev.className || prev.studentName) {
      mergedAnnotations = { ...prev };
    }
    if (annotations && typeof annotations === 'object' && !Array.isArray(annotations)) {
      mergedAnnotations = { ...(mergedAnnotations || {}), ...annotations };
    }

    const { data, error } = await supabase
      .from('submissions')
      .update({
        grade,
        feedback,
        annotations: mergedAnnotations,
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
 * GET /api/v1/submissions/:id
 */
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.from('submissions').select('*').eq('id', id).single();

    if (error) {
      console.error('查询失败:', error);
      return res.status(500).json({ success: false, message: '查询失败' });
    }

    if (!data) {
      return res.status(404).json({ success: false, message: '未找到记录' });
    }

    res.json({ success: true, data: { ...data, meta: getMeta(data.annotations) } });
  } catch (error) {
    console.error('查询错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

/**
 * 班级学情报告（Word 下载，仅老师）
 * POST /api/v1/submissions/class/:className/report
 */
router.post('/class/:className/report', optionalAuthMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!isTeacher(req)) {
      return res.status(403).json({ success: false, message: '无权限查看' });
    }
    const className = String(req.params.className);
    if (!CLASSES.includes(className)) {
      return res.status(400).json({ success: false, message: '未知班级' });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('annotations->>className', className)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('报告查询失败:', error);
      return res.status(500).json({ success: false, message: '查询失败' });
    }

    const rows = data || [];
    const total = rows.length;
    const pending = rows.filter((s) => s.status === 'pending').length;
    const graded = rows.filter((s) => s.status === 'graded').length;
    const studentsMap = new Map<string, { count: number; lastTime?: string }>();
    for (const s of rows) {
      const m = getMeta(s.annotations);
      const key = m.studentName || '匿名';
      const cur = studentsMap.get(key) || { count: 0 };
      cur.count += 1;
      cur.lastTime = s.created_at || cur.lastTime;
      studentsMap.set(key, cur);
    }
    const byStudent = Array.from(studentsMap.entries())
      .map(([name, v]) => ({ name, count: v.count, lastTime: v.lastTime }))
      .sort((a, b) => b.count - a.count);

    const now = new Date().toLocaleString('zh-CN');

    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType } = await import('docx');

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: `${className} 学生作业学情报告`, bold: true, size: 36 })],
            }),
            new Paragraph({ text: '', spacing: { after: 120 } }),
            new Paragraph({ children: [new TextRun({ text: `生成时间：${now}`, size: 21, color: '666666' })] }),
            new Paragraph({ children: [new TextRun({ text: '', size: 10 })] }),
            new Paragraph({
              children: [new TextRun({ text: `班内共收集作业 ${total} 份，参与学生 ${byStudent.length} 人；待批改 ${pending} 份，已批改 ${graded} 份。`, size: 24 })],
            }),
            new Paragraph({ text: '', spacing: { after: 160 } }),
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '一、班级作业概览', bold: true, size: 30 })] }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('总份数')] }),
                    new TableCell({ children: [new Paragraph('参与学生')] }),
                    new TableCell({ children: [new Paragraph('待批改')] }),
                    new TableCell({ children: [new Paragraph('已批改')] }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph(String(total))] }),
                    new TableCell({ children: [new Paragraph(String(byStudent.length))] }),
                    new TableCell({ children: [new Paragraph(String(pending))] }),
                    new TableCell({ children: [new Paragraph(String(graded))] }),
                  ],
                }),
              ],
            }),
            new Paragraph({ text: '', spacing: { after: 160 } }),
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '二、学生提交明细', bold: true, size: 30 })] }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('序号')] }),
                    new TableCell({ children: [new Paragraph('姓名')] }),
                    new TableCell({ children: [new Paragraph('提交份数')] }),
                    new TableCell({ children: [new Paragraph('最近提交时间')] }),
                  ],
                }),
                ...byStudent.map((st, i) =>
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph(String(i + 1))] }),
                      new TableCell({ children: [new Paragraph(st.name)] }),
                      new TableCell({ children: [new Paragraph(String(st.count))] }),
                      new TableCell({ children: [new Paragraph(st.lastTime ? new Date(st.lastTime).toLocaleString('zh-CN') : '—')] }),
                    ],
                  })
                ),
              ],
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="class-report.docx"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('报告生成错误:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: '报告生成失败' });
    }
  }
});

export default router;