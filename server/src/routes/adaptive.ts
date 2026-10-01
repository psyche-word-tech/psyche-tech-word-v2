import { Router, type Response } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth';
import { getSupabaseClient } from '../storage/database/supabase-client';

const router = Router();

// 试点学生：学生端仅该手机号可见「我的训练」
const PILOT_STUDENT_PHONE = '15672049317';
// 自适应训练记录复用 submissions 表，用 status 标记区分
const ADAPTIVE_STATUS = 'adaptive';

export const QUESTION_TYPES = [
  '单选',
  '翻译句',
  '段落翻译',
  '阅读理解',
  '七选五',
  '完形填空',
  '语法填空',
] as const;

function getQwenKey(): string {
  return process.env.QWEN_API_KEY || '';
}
function getQwenUrl(): string {
  const base =
    process.env.QWEN_API_URL ||
    'https://ws-93mjw4d2mm946w5o.cn-beijing.maas.aliyuncs.com/compatible-mode/v1';
  return base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
}
function getQwenModel(): string {
  return process.env.QWEN_MODEL || 'qwen3.8-flash';
}

function levelDesc(level: number): string {
  if (level <= 2) return '基础（词汇句型简单，句子短，考查基本语法与常用词）';
  if (level <= 4) return '中等（有一定从句与连接词，词汇为课标常用范围）';
  return '较难（长难句、非谓语/从句综合、词汇有区分度）';
}

function buildPrompt(level: number, types: string[], duration: number): string {
  const typeSpec = types
    .map((t) => {
      switch (t) {
        case '单选':
          return `{"type":"单选","q":"题干(英文,空用____表示)","options":["A","B","C","D"]四个选项文本,"answer":"正确选项文本","explain":"简短解析"}`;
        case '翻译句':
          return `{"type":"翻译句","q":"要翻译的中文句子","answer":"英文参考译文"}`;
        case '段落翻译':
          return `{"type":"段落翻译","q":"要翻译的中文段落(2-4句)","answer":"英文参考译文"}`;
        case '阅读理解':
          return `{"type":"阅读理解","passage":"一篇短英文文章","items":[{"q":"问题","options":["A","B","C","D"],"answer":"正确选项文本"}]1-2题}`;
        case '七选五':
          return `{"type":"七选五","passage":"含5个空(用__1__..__5__标记)的英文短文","options":["7个候选句A-G"],"answers":["5个空对应选项字母"]}`;
        case '完形填空':
          return `{"type":"完形填空","passage":"含若干空(用__1__..__n__标记)的英文短文","items":[{"options":["A","B","C","D"],"answer":"正确选项文本"}]与空一一对应}`;
        case '语法填空':
          return `{"type":"语法填空","passage":"含若干空(用__1__..__n__标记,括号给提示词)的英文短文","answers":["每空答案"]}`;
        default:
          return `{"type":"${t}","q":"题目","answer":"答案"}`;
      }
    })
    .join('\n');

  return `你是一名中学英语命题专家。请为一名书面表达能力等级为 L${level}（1-6，${levelDesc(
    level
  )}）的学生命制一套限时 ${duration} 分钟的英语训练题。
要求：
1. 只输出一个 JSON 数组，不要任何额外文字、不要 markdown 代码块。
2. 数组中每个元素是一道题，必须包含 "type" 字段，且只使用以下题型：${types.join('、')}。
3. 每种题型出 1 道（"单选"出 2 道），难度严格匹配该生等级。
4. 各题型元素结构如下：
${typeSpec}
5. 所有英文内容难度与 L${level} 匹配，答案必须正确。`;
}

function extractJsonArray(text: string): any[] | null {
  if (!text) return null;
  const tryParse = (s: string) => {
    try {
      const v = JSON.parse(s);
      return Array.isArray(v) ? v : null;
    } catch {
      return null;
    }
  };
  const direct = tryParse(text.trim());
  if (direct) return direct;
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start >= 0 && end > start) {
    const inner = tryParse(text.slice(start, end + 1));
    if (inner) return inner;
  }
  return null;
}

async function generateQuestions(level: number, types: string[], duration: number) {
  const res = await fetch(getQwenUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getQwenKey()}` },
    body: JSON.stringify({
      model: getQwenModel(),
      messages: [{ role: 'user', content: buildPrompt(level, types, duration) }],
      temperature: 0.3,
      max_tokens: 4000,
    }),
  });
  if (!res.ok) throw new Error(`Qwen HTTP ${res.status}`);
  const data: any = await res.json();
  const content = data?.choices?.[0]?.message?.content || '';
  const arr = extractJsonArray(content);
  if (!arr || arr.length === 0) throw new Error('模型输出无法解析为题数组');
  return arr;
}

async function classStudents(className: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('submissions').select('annotations, status');
  if (error) throw error;
  const byUser = new Map<string, { name: string; ratios: number[] }>();
  for (const row of data || []) {
    if ((row as any).status === ADAPTIVE_STATUS) continue;
    const a = (row as any).annotations || {};
    if (a.className !== className) continue;
    const g = a.grading;
    if (!g || typeof g.total_score !== 'number' || !g.max_score) continue;
    const uid = String(a.userId || '');
    if (!uid) continue;
    if (!byUser.has(uid)) byUser.set(uid, { name: a.studentName || '学生', ratios: [] });
    byUser.get(uid)!.ratios.push(g.total_score / g.max_score);
  }
  const students: { userId: string; name: string; level: number }[] = [];
  byUser.forEach((v, uid) => {
    const avg = v.ratios.reduce((s, r) => s + r, 0) / v.ratios.length;
    students.push({ userId: uid, name: v.name, level: Math.min(6, Math.max(1, Math.round(avg * 6))) });
  });
  return students;
}

// 教师：获取可布置学生列表（班级学生 + 试点学生）
router.get('/students', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const className = String(req.query.className || '318班');
    const students = await classStudents(className);
    const supabase = getSupabaseClient();
    const { data: pilot } = await supabase
      .from('users')
      .select('*')
      .eq('phone', PILOT_STUDENT_PHONE)
      .limit(1);
    const pilotUser = pilot?.[0] as any;
    const list = students.map((s) => ({ ...s, isPilot: false }));
    if (pilotUser) {
      const pid = String(pilotUser.id);
      const existing = list.find((s) => s.userId === pid);
      if (existing) existing.isPilot = true;
      else
        list.push({
          userId: pid,
          name: pilotUser.name || pilotUser.nickname || '试点学生',
          level: 3,
          isPilot: true,
        });
    }
    res.json({ success: true, data: { className, students: list } });
  } catch (e: any) {
    console.error('[adaptive] students error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// 教师：一键布置（为每个选中学生按能力生成个性化题）
router.post('/assign', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { className, questionTypes, durationMin, students } = req.body as {
      className: string;
      questionTypes: string[];
      durationMin: number;
      students: { userId: string; name: string; level: number; phone?: string }[];
    };
    if (!className || !questionTypes?.length || !students?.length) {
      return res.status(400).json({ success: false, error: '参数不完整' });
    }
    const duration = Number(durationMin) || 30;
    const assignmentId = `${Date.now()}`;
    const supabase = getSupabaseClient();
    const results: { userId: string; name: string; ok: boolean; count: number; error?: string }[] =
      [];
    for (const stu of students) {
      try {
        const questions = await generateQuestions(Number(stu.level) || 3, questionTypes, duration);
        const { error } = await supabase.from('submissions').insert({
          student_id: '00000000-0000-0000-0000-000000000000',
          image_url: '',
          status: ADAPTIVE_STATUS,
          annotations: {
            adaptive: true,
            assignmentId,
            className,
            userId: String(stu.userId),
            studentName: stu.name,
            level: Number(stu.level) || 3,
            questionTypes,
            durationMin: duration,
            questions,
          },
        });
        if (error) throw new Error(error.message);
        results.push({ userId: stu.userId, name: stu.name, ok: true, count: questions.length });
      } catch (e: any) {
        results.push({ userId: stu.userId, name: stu.name, ok: false, count: 0, error: e.message });
      }
    }
    res.json({ success: true, data: { assignmentId, results } });
  } catch (e: any) {
    console.error('[adaptive] assign error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// 学生：我的训练（仅试点手机号可见）
router.get('/my-sets', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    const { data: user } = await supabase.from('users').select('phone').eq('id', req.userId).limit(1);
    const phone = user?.[0]?.phone;
    if (phone !== PILOT_STUDENT_PHONE) return res.json({ success: true, data: { sets: [] } });
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('status', ADAPTIVE_STATUS)
      .eq('annotations->>userId', String(req.userId))
      .order('created_at', { ascending: false });
    if (error) throw error;
    const sets = (data || []).map((s: any) => {
      const a = s.annotations || {};
      return {
        id: s.id,
        className: a.className,
        level: a.level,
        questionTypes: a.questionTypes || [],
        durationMin: a.durationMin || 30,
        questions: a.questions || [],
        createdAt: s.created_at,
      };
    });
    res.json({ success: true, data: { sets } });
  } catch (e: any) {
    console.error('[adaptive] my-sets error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
