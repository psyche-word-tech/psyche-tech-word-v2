import { Router } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { authMiddleware, type AuthRequest } from '../middleware/auth';

const router = Router();

// 与前端 competency-map 页一致的能力项（按既有能力项目归类）
const ABILITIES = ['介词', '冠词', '连词', '代词', '谓语', '动名词', '不定式', '过去分词', '现在分词', '形容词', '名词', '词性变换'];

// knowledge_point → 能力项 关键词映射（先匹配具体项，泛指词后置）
const ABILITY_KEYWORDS: Record<string, string[]> = {
  介词: ['介词'],
  冠词: ['冠词'],
  连词: ['连词', '连接词'],
  代词: ['代词'],
  谓语: ['谓语', '主谓', '时态', '语态', '系动词'],
  动名词: ['动名词'],
  不定式: ['不定式'],
  过去分词: ['过去分词'],
  现在分词: ['现在分词'],
  形容词: ['形容词', '比较级', '最高级'],
  名词: ['名词', '单复数', '可数', '不可数'],
  词性变换: ['词性', '转换', '派生', '构词'],
};

function mapAbility(knowledge: string): string | null {
  const k = String(knowledge || '').replace(/\s+/g, '');
  if (!k) return null;
  // 先扫包含多个具体关键词的项（过去/现在分词优先于泛指词性）
  for (const ab of ['过去分词', '现在分词', '动名词', '不定式']) {
    for (const kw of ABILITY_KEYWORDS[ab] || []) {
      if (k.includes(kw)) return ab;
    }
  }
  for (const ab of ABILITIES) {
    for (const kw of ABILITY_KEYWORDS[ab] || []) {
      if (k.includes(kw)) return ab;
    }
  }
  return null;
}

function normalizeDiff(d: string): string | null {
  const m = String(d || '').match(/(?:L|l)?([1-6])/);
  return m ? 'L' + m[1] : null;
}

router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const supabase = getSupabaseClient();
    const uid = req.userId!;
    const { data, error } = await supabase.from('favorites').select('subject, tips').eq('user_id', uid);
    if (error) throw error;

    const byAbility = new Map<string, { correct: number; wrong: number }>();
    const byKnowledge = new Map<string, { correct: number; wrong: number }>();
    const byCompetency = new Map<string, number>();
    const byDifficulty = new Map<string, number>();
    const bySubject = new Map<string, number>();

    for (const r of data || []) {
      let t: any = {};
      try {
        t = JSON.parse(r.tips || '{}');
      } catch { /* 忽略坏 tips */ }
      const status = String(t.status || '');
      const isWeak = status === 'wrong' || status === 'attention';
      if (!isWeak && status !== 'correct' && status !== 'blank') continue;

      const ab = mapAbility(String(t.knowledge_point || ''));
      if (ab) {
        const cur = byAbility.get(ab) || { correct: 0, wrong: 0 };
        if (status === 'correct') cur.correct++;
        else cur.wrong++;
        byAbility.set(ab, cur);
      }
      const kp = String(t.knowledge_point || '').trim();
      if (kp) {
        const cur = byKnowledge.get(kp) || { correct: 0, wrong: 0 };
        if (status === 'correct') cur.correct++;
        else cur.wrong++;
        byKnowledge.set(kp, cur);
      }
      const cc = String(t.core_competency || '').trim();
      if (cc) byCompetency.set(cc, (byCompetency.get(cc) || 0) + 1);
      const diff = normalizeDiff(String(t.difficulty || ''));
      if (diff) byDifficulty.set(diff, (byDifficulty.get(diff) || 0) + 1);
      const subj = String(r.subject || '未知').trim() || '未知';
      bySubject.set(subj, (bySubject.get(subj) || 0) + 1);
    }

    const abilities = ABILITIES.map((label) => {
      const a = byAbility.get(label);
      const total = (a?.correct || 0) + (a?.wrong || 0);
      return {
        label,
        value: total > 0 ? Math.round((a!.correct / total) * 100) / 100 : null,
        correct: a?.correct || 0,
        wrong: a?.wrong || 0,
        total,
      };
    });

    const knowledge = Array.from(byKnowledge.entries())
      .map(([name, v]) => ({ name, correct: v.correct, wrong: v.wrong, total: v.correct + v.wrong }))
      .sort((a, b) => b.total - a.total);

    const competency = Array.from(byCompetency.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const difficulty = Array.from(byDifficulty.entries())
      .map(([level, count]) => ({ level, count }))
      .sort((a, b) => a.level.localeCompare(b.level));

    const subjects = Array.from(bySubject.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      success: true,
      data: { abilities, knowledge, competency, difficulty, subjects, total: (data || []).length },
    });
  } catch (e: any) {
    console.error('[CompetencyMap] 计算失败:', e.message);
    res.status(500).json({ success: false, message: '能力图谱计算失败' });
  }
});

export default router;