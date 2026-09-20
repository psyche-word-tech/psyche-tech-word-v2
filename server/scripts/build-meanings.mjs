// 为 gk_vocab 批量生成中文释义并写入 meaning 列
// 用法: node scripts/build-meanings.mjs [batchLimit]   (batchLimit>0 时只跑前 N 批用于试跑，不写库)
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const __this = path.dirname(new URL(import.meta.url).pathname); // server/scripts
const __root = path.resolve(__this, '..'); // server/
const env = {};
for (const line of fs.readFileSync(path.join(__root, '.env'), 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const client = createClient(env.COZE_SUPABASE_URL, env.COZE_SUPABASE_SERVICE_ROLE_KEY || env.COZE_SUPABASE_ANON_KEY);

const apiUrl = (env.QWEN_API_URL || 'https://ws-93mjw4d2mm946w5o.cn-beijing.maas.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '');
const chatUrl = apiUrl.includes('/chat/completions') ? apiUrl : `${apiUrl}/chat/completions`;
const apiKey = env.QWEN_API_KEY;
const model = env.QWEN_MODEL || 'qwen3.8-max';

const BATCH = 100;
const tryLimit = Number(process.argv[2] || 0);

async function callQwen(words) {
  const list = words.map(w => w.word).join('\n');
  const sys =
    '你是英汉词典助手。把给出的每个英文单词翻译成简洁准确的中文释义（含词性或中文惯用语境），只输出一个 JSON 对象，' +
    '键是原英文单词（含标点、数字、a/an、a.m. 等原样），值是中文释义字符串（如 "苹果；[a] apple 用于元音前"）。不要输出其它内容。';
  const user = `单词清单（每行一个）：\n${list}`;
  const res = await fetch(chatUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ], temperature: 0.2, enable_thinking: false }),
  });
  if (!res.ok) throw new Error(`qwen ${res.status}: ${await res.text()}`);
  const text = (await res.json()).choices?.[0]?.message?.content || '';
  let cleaned = text.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim();
  const s = cleaned.indexOf('{');
  const e = cleaned.lastIndexOf('}');
  if (s < 0 || e <= s) throw new Error('无 JSON 对象: ' + text.slice(0, 200));
  return JSON.parse(cleaned.slice(s, e + 1));
}

async function main() {
  const PAGE = 1000;
  const todo = [];
  for (let r = 0; ; r += PAGE) {
    const { data, error } = await client.from('gk_vocab')
      .select('id, word, meaning')
      .or('meaning.is.null,meaning.eq.' + '')
      .range(r, r + PAGE - 1);
    if (error) throw error;
    const rows = data || [];
    todo.push(...rows);
    if (rows.length < PAGE) break;
  }
  const words = todo.filter(w => !w.meaning || !String(w.meaning).trim());
  console.log(`待填释义词数: ${words.length}`);
  if (words.length === 0) { console.log('已全部有释义'); return; }

  let done = 0, fail = 0;
  const payloadMode = tryLimit > 0; // 试跑只打印不写库
  for (let i = 0; i < words.length; i += BATCH) {
    if (tryLimit > 0 && i / BATCH >= tryLimit) break;
    const chunk = words.slice(i, i + BATCH);
    try {
      const map = await callQwen(chunk);
      let ok = 0;
      for (const w of chunk) {
        const m = map[w.word];
        if (typeof m === 'string' && m.trim()) {
          if (!payloadMode) {
            await client.from('gk_vocab').update({ meaning: m.trim() }).eq('word', w.word);
          }
          ok++;
        }
      }
      done += ok; fail += chunk.length - ok;
      if (payloadMode) {
        console.log(`[试跑批 ${i / BATCH}] 命中 ${ok}/${chunk.length}, 样例:`, map[chunk[0].word], '|', map[chunk[1] && chunk[1].word]);
      } else {
        console.log(`[批 ${i / BATCH}] 完成 ${ok}/${chunk.length}`);
      }
    } catch (err) {
      fail += chunk.length;
      console.error(`[批 ${i / BATCH}] 失败: ${err.message}`);
    }
    await new Promise(rr => setTimeout(rr, 800));
  }
  console.log(`完成。成功 ${done}，失败 ${fail}${payloadMode ? '（试跑模式，未写库）' : ''}`);
}

main().catch(e => { console.error('fatal', e); process.exit(1); });