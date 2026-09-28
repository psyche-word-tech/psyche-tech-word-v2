// 专业推荐：能力家族聚合 + 门类匹配（原型）
// 依据：跨学科知识点-能力映射谱系（R01-R10）；14 高等教育学科门类核心能力

export const ABILITY_NAMES = [
  '推理与论证',
  '批判性思维与创新',
  '证据与实证',
  '模型建构与抽象',
  '实验探究',
  '信息处理与量化',
  '表达与交流',
  '价值判断与社会责任',
  '文化理解与传承',
  '自主学习与元认知',
];
export const ABILITY_IDS = ['R01','R02','R03','R04','R05','R06','R07','R08','R09','R10'] as const;

export const ABILITY_COLORS = [
  '#EF4444', '#3B82F6', '#22C55E', '#F97316', '#8B5CF6',
  '#14B8A6', '#EC4899', '#A16207', '#7C3AED', '#0EA5E9',
];

// 学科 → 能力家族权重矩阵（0-5，基于课标与能力映射谱系整理，可微调）
// 行序：语文 数学 外语 物理 化学 生物 政治 历史 地理；列序 R01..R10
export const SUBJECT_ABILITY_MATRIX: Record<string, number[]> = {
  语文: [4, 3, 4, 3, 0, 4, 5, 2, 5, 3],
  数学: [5, 3, 3, 5, 0, 4, 1, 0, 0, 3],
  外语: [2, 1, 0, 1, 0, 4, 5, 3, 4, 3],
  物理: [4, 2, 3, 5, 5, 4, 1, 1, 0, 3],
  化学: [4, 2, 4, 4, 5, 3, 1, 3, 0, 3],
  生物: [4, 2, 4, 4, 5, 3, 1, 3, 1, 3],
  政治: [3, 3, 3, 1, 0, 3, 4, 5, 4, 2],
  历史: [4, 3, 5, 2, 0, 4, 3, 3, 5, 2],
  地理: [3, 2, 3, 4, 1, 5, 2, 3, 2, 3],
};

// 14 高等教育学科门类 → 能力需求权重（0-5），列序 R01..R10
export const FIELD_ABILITY_NEED: Record<string, number[]> = {
  哲学:   [4, 5, 3, 5, 0, 2, 4, 4, 3, 2],
  经济学: [4, 3, 4, 4, 0, 5, 3, 3, 1, 3],
  法学:   [5, 3, 4, 3, 0, 2, 4, 5, 3, 2],
  教育学: [2, 3, 2, 3, 1, 3, 5, 4, 3, 5],
  文学:   [2, 4, 2, 2, 0, 3, 5, 3, 5, 3],
  历史学: [4, 3, 5, 2, 1, 4, 3, 3, 5, 3],
  理学:   [5, 3, 4, 5, 4, 5, 1, 1, 1, 3],
  工学:   [4, 3, 4, 5, 4, 5, 2, 2, 1, 4],
  农学:   [3, 2, 4, 3, 5, 4, 2, 4, 2, 3],
  医学:   [4, 3, 5, 3, 4, 3, 3, 5, 2, 4],
  军事学: [4, 3, 3, 3, 2, 3, 4, 4, 2, 4],
  管理学: [3, 3, 4, 4, 0, 5, 4, 3, 2, 4],
  艺术学: [1, 5, 1, 3, 2, 2, 5, 3, 5, 3],
  交叉学科: [4, 4, 3, 5, 2, 5, 2, 4, 2, 5],
};

// 门类 → 代表专业（按学科目录初步列出一版）
export const FIELD_MAJORS: Record<string, string[]> = {
  哲学: ['哲学', '逻辑学', '伦理学'],
  经济学: ['经济学', '金融学', '国际经济与贸易'],
  法学: ['法学', '政治学与行政学', '社会学', '思想政治教育'],
  教育学: ['教育学', '学前教育', '小学教育', '教育技术学'],
  文学: ['汉语言文学', '英语', '新闻学', '外国语言文学'],
  历史学: ['历史学', '世界史', '考古学'],
  理学: ['数学与应用数学', '物理学', '化学', '生物科学', '地理科学', '应用统计学'],
  工学: ['计算机科学与技术', '软件工程', '机械工程', '电气工程', '土木工程', '自动化'],
  农学: ['农学', '园艺', '动物科学', '植物保护', '林学'],
  医学: ['临床医学', '口腔医学', '药学', '基础医学', '中医学'],
  军事学: ['军事指挥（国防生类）'],
  管理学: ['工商管理', '会计学', '公共事业管理', '市场营销', '管理科学与工程'],
  艺术学: ['视觉传达设计', '美术学', '音乐学', '广播电视编导'],
  交叉学科: ['人工智能', '数据科学与大数据技术', '金融科技'],
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// 聚合：由学生各科学科等级(L1-L6) → 10 维能力家族向量（归一化到 1-6）
export function aggregateAbility(subjectLevels: Record<string, number>): number[] {
  const vec = new Array(10).fill(0);
  let total = 0;
  for (const [subj, level] of Object.entries(subjectLevels)) {
    const row = SUBJECT_ABILITY_MATRIX[subj];
    if (!row) continue;
    for (let i = 0; i < 10; i++) vec[i] += (level ?? 1) * row[i];
    total += (level ?? 1);
  }
  if (total <= 0) return new Array(10).fill(1);
  // 每个能力取 学科加权平均(0-30 scale) 映射到 1-6
  return vec.map((v) => clamp(Math.round((v / total) / 5 * 5 + 1), 1, 6));
}

// 二级学科 → 能力需求（门类 → 专业 → 细分方向能力模板，列序 R01..R10）
// 仅覆盖主要专业，可继续扩充；未被覆盖的专业返回空，前端提示"暂无细化方向"
export const SPECIALTY_ABILITY_NEED: Record<string, Record<string, { name: string; need: number[] }[]>> = {
  教育学: {
    教育学: [
      { name: '课程与教学论', need: [2, 4, 2, 3, 0, 3, 5, 4, 3, 5] },
      { name: '教育心理学', need: [3, 4, 4, 3, 2, 3, 4, 4, 3, 5] },
      { name: '教育技术学', need: [2, 3, 2, 5, 3, 5, 3, 2, 2, 4] },
      { name: '教育测量与评价', need: [3, 3, 5, 4, 1, 5, 3, 3, 1, 4] },
    ],
    教育技术学: [
      { name: '信息化教学设计', need: [2, 3, 2, 4, 3, 5, 4, 3, 3, 5] },
      { name: '学习分析', need: [3, 3, 4, 5, 1, 5, 3, 2, 1, 4] },
      { name: '教育游戏与交互设计', need: [2, 5, 2, 4, 3, 4, 4, 2, 3, 4] },
    ],
  },
  文学: {
    汉语言文学: [
      { name: '汉语言文字学', need: [4, 3, 5, 3, 1, 4, 4, 3, 5, 3] },
      { name: '中国古代文学', need: [4, 4, 4, 2, 0, 3, 4, 3, 5, 3] },
      { name: '中国现当代文学', need: [2, 5, 2, 2, 0, 3, 5, 3, 5, 4] },
      { name: '文艺学', need: [2, 5, 2, 2, 0, 2, 5, 3, 5, 3] },
    ],
    英语: [
      { name: '英语语言文学', need: [3, 3, 4, 2, 0, 4, 5, 3, 5, 3] },
      { name: '翻译学', need: [3, 4, 3, 3, 0, 4, 5, 3, 4, 3] },
      { name: '外国语言学及应用语言学', need: [3, 3, 5, 3, 1, 4, 4, 3, 3, 3] },
    ],
    新闻学: [
      { name: '新闻学', need: [2, 4, 3, 2, 0, 4, 5, 4, 4, 4] },
      { name: '传播学', need: [2, 5, 3, 3, 0, 4, 5, 4, 3, 4] },
      { name: '网络与新媒体', need: [2, 4, 3, 3, 0, 5, 5, 3, 3, 4] },
    ],
  },
  理学: {
    数学与应用数学: [
      { name: '基础数学', need: [5, 3, 3, 5, 0, 4, 1, 0, 0, 3] },
      { name: '计算数学', need: [4, 3, 3, 5, 0, 5, 1, 0, 0, 4] },
      { name: '应用数学', need: [4, 3, 4, 5, 3, 5, 2, 2, 1, 4] },
      { name: '概率论与数理统计', need: [4, 3, 5, 4, 1, 5, 2, 1, 0, 3] },
    ],
    物理学: [
      { name: '理论物理', need: [5, 3, 3, 5, 3, 4, 1, 1, 0, 4] },
      { name: '光学', need: [4, 2, 4, 5, 5, 3, 1, 1, 0, 3] },
      { name: '凝聚态物理', need: [4, 2, 5, 5, 5, 3, 1, 1, 0, 3] },
    ],
    化学: [
      { name: '有机化学', need: [4, 2, 4, 4, 5, 2, 1, 3, 0, 4] },
      { name: '分析化学', need: [4, 2, 5, 4, 5, 3, 1, 2, 0, 3] },
      { name: '物理化学', need: [5, 3, 4, 5, 4, 4, 1, 2, 0, 4] },
    ],
  },
  工学: {
    计算机科学与技术: [
      { name: '计算机系统结构', need: [4, 3, 2, 5, 2, 5, 1, 1, 0, 4] },
      { name: '计算机软件与理论', need: [5, 3, 3, 5, 1, 4, 1, 0, 0, 4] },
      { name: '计算机应用技术', need: [3, 3, 3, 4, 3, 5, 2, 2, 1, 4] },
      { name: '人工智能', need: [4, 5, 3, 5, 2, 5, 2, 2, 1, 5] },
    ],
    软件工程: [
      { name: '软件工程技术', need: [4, 3, 3, 5, 2, 5, 1, 0, 0, 4] },
      { name: '软件体系结构', need: [5, 4, 3, 5, 1, 4, 1, 1, 0, 4] },
      { name: '数据工程', need: [4, 3, 4, 5, 2, 5, 2, 1, 1, 4] },
    ],
    机械工程: [
      { name: '机械设计及理论', need: [4, 2, 4, 5, 4, 4, 1, 2, 0, 3] },
      { name: '机械制造及其自动化', need: [4, 2, 3, 5, 5, 4, 1, 2, 0, 4] },
      { name: '机械电子工程', need: [4, 3, 4, 5, 5, 4, 1, 1, 0, 4] },
    ],
  },
  医学: {
    临床医学: [
      { name: '内科学', need: [4, 2, 5, 3, 4, 3, 3, 5, 2, 4] },
      { name: '外科学', need: [5, 2, 4, 4, 5, 3, 2, 4, 1, 4] },
      { name: '儿科学', need: [4, 2, 5, 3, 4, 3, 4, 5, 2, 4] },
      { name: '影像医学与核医学', need: [3, 2, 5, 4, 3, 5, 2, 4, 1, 4] },
    ],
    药学: [
      { name: '药物化学', need: [4, 2, 4, 4, 5, 3, 1, 3, 0, 4] },
      { name: '药剂学', need: [3, 2, 4, 4, 5, 3, 2, 3, 1, 4] },
      { name: '药理学', need: [4, 3, 5, 3, 4, 3, 2, 4, 1, 4] },
    ],
  },
  管理学: {
    工商管理: [
      { name: '企业管理', need: [3, 3, 3, 4, 0, 4, 5, 4, 2, 5] },
      { name: '会计学', need: [4, 2, 5, 4, 0, 5, 3, 3, 1, 4] },
      { name: '市场营销', need: [2, 4, 2, 3, 0, 4, 5, 3, 2, 5] },
      { name: '技术经济及管理', need: [3, 3, 4, 5, 0, 5, 3, 3, 1, 5] },
    ],
    公共事业管理: [
      { name: '行政管理', need: [3, 3, 4, 3, 0, 3, 4, 5, 3, 4] },
      { name: '社会保障', need: [3, 3, 5, 3, 0, 4, 3, 5, 3, 4] },
      { name: '卫生事业管理', need: [3, 3, 5, 3, 1, 4, 4, 5, 2, 4] },
    ],
  },
};

// 精准匹配：学生能力向量 vs 指定专业下各二级学科需求（余弦相似度 → 百分比）
export function matchSpecialties(
  subjectLevels: Record<string, number>,
  field: string,
  major: string
): { ability: number[]; specs: { name: string; score: number }[] } {
  const ability = aggregateAbility(subjectLevels);
  const norm = Math.sqrt(ability.reduce((s, x) => s + x * x, 0)) || 1;
  const specs = ((SPECIALTY_ABILITY_NEED[field] || {})[major] || []).map((spec) => {
    const need = spec.need;
    const n2 = Math.sqrt(need.reduce((s, x) => s + x * x, 0)) || 1;
    let dot = 0;
    for (let i = 0; i < 10; i++) dot += ability[i] * need[i];
    return { name: spec.name, score: Math.round((dot / (norm * n2)) * 100) };
  }).sort((a, b) => b.score - a.score);
  return { ability, specs };
}

// 门类级二级学科精准匹配：把某门类下所有代表专业的二级学科铺平，统一按匹配度排序
export function matchFieldSpecialties(
  subjectLevels: Record<string, number>,
  field: string
): { major: string; name: string; score: number }[] {
  const ability = aggregateAbility(subjectLevels);
  const norm = Math.sqrt(ability.reduce((s, x) => s + x * x, 0)) || 1;
  const out: { major: string; name: string; score: number }[] = [];
  const fields = SPECIALTY_ABILITY_NEED[field] || {};
  for (const major of Object.keys(fields)) {
    const specs = fields[major] || [];
    for (const spec of specs) {
      const n2 = Math.sqrt(spec.need.reduce((s, x) => s + x * x, 0)) || 1;
      let dot = 0;
      for (let i = 0; i < 10; i++) dot += ability[i] * spec.need[i];
      out.push({ major, name: spec.name, score: Math.round((dot / (norm * n2)) * 100) });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

// 匹配：学生能力向量 vs 门类需求向量（余弦相似度 → 百分比）
export function recommendStudent(subjectLevels: Record<string, number>): {
  ability: number[]; fields: { field: string; score: number; majors: string[] }[];
} {
  const ability = aggregateAbility(subjectLevels);
  const norm = Math.sqrt(ability.reduce((s, x) => s + x * x, 0)) || 1;
  const fields = Object.keys(FIELD_ABILITY_NEED).map((field) => {
    const need = FIELD_ABILITY_NEED[field];
    const n2 = Math.sqrt(need.reduce((s, x) => s + x * x, 0)) || 1;
    let dot = 0;
    for (let i = 0; i < 10; i++) dot += ability[i] * need[i];
    return { field, score: Math.round((dot / (norm * n2)) * 100), majors: FIELD_MAJORS[field] || [] };
  }).sort((a, b) => b.score - a.score);
  return { ability, fields };
}