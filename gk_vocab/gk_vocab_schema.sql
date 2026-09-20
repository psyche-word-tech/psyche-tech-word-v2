-- =====================================================================
-- 高中英语课程标准词汇库 + 词汇量测试记录表
-- 来源：《普通高中英语课程标准》附录2 词汇表（共收录 3100 词，本库 3175 词）
-- 说明：课标词汇表本身不标注中文释义，故 meaning 字段留空占位，
--        如需释义可后续用词典数据补充，不影响词汇量测试。
-- 执行方式：全部选中 → 在 Supabase SQL Editor 粘贴 → Run
-- =====================================================================

-- 1) 高中课程标准词汇表
CREATE TABLE IF NOT EXISTS public.gk_vocab (
  id bigserial PRIMARY KEY,
  word text NOT NULL,
  level text NOT NULL DEFAULT 'base',           -- base=义务教育 / required=必修 / elective=选择性必修
  variant text,                                 -- 美式拼写或其他拼写注释（如 analyze）
  meaning text,                                 -- 中文释义（课标无，预留可补）
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gk_vocab_word_key UNIQUE (word)
);

CREATE INDEX IF NOT EXISTS idx_gk_vocab_level ON public.gk_vocab (level);
CREATE INDEX IF NOT EXISTS idx_gk_vocab_word  ON public.gk_vocab (word);

-- 2) 词汇量测试记录表（每次测试存一条结果，可后续做复测对比）
CREATE TABLE IF NOT EXISTS public.vocab_test_records (
  id bigserial PRIMARY KEY,
  user_id integer REFERENCES public.users(id),
  level text NOT NULL DEFAULT 'all',            -- 本次测试范围（默认全表 all）
  sample_count integer NOT NULL DEFAULT 0,      -- 本次抽样题数
  known_count integer NOT NULL DEFAULT 0,       -- 判定"认识"的数量
  estimated_vocab integer NOT NULL DEFAULT 0,   -- 估算词汇量
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vocab_test_records_user ON public.vocab_test_records (user_id);
CREATE INDEX IF NOT EXISTS idx_vocab_test_records_created ON public.vocab_test_records (created_at);

-- 3) 启用 RLS（后端使用 service_role_key 自动绕过，无需额外 policy）
--    RLS 开启且不建 policy = anon key 无法读写，安全兜底
ALTER TABLE public.gk_vocab ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocab_test_records ENABLE ROW LEVEL SECURITY;
