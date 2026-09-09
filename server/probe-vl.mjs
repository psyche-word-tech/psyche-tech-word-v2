import { PaddleOCRClient, Model } from '@paddleocr/api-sdk';
import fs from 'fs';

const env = fs.readFileSync('/workspace/projects/server/.env', 'utf8');
const token = (env.match(/PADDLEOCR_ACCESS_TOKEN=(.*)/) || [])[1]?.trim();
const client = new PaddleOCRClient({ token, requestTimeout: 60000, pollTimeout: 240000 });

const r = await client.parseDocument({
  filePath: '/tmp/paddleocr_1788944564377.jpg',
  model: Model.PaddleOCRVL16,
  options: { layoutShapeMode: 'quad', outputFormats: ['json'], maxNewTokens: 4000 },
});
const page = r.pages?.[0];
const keys = Object.keys(page || {});
console.log('=== page keys ===', JSON.stringify(keys));
// 深度扫描找含 bbox/poly/word 的数组结构
function scan(obj, path, depth) {
  if (depth > 3 || obj == null) return;
  if (Array.isArray(obj)) {
    if (obj.length && typeof obj[0] === 'object') {
      // 块级数组
      const k0 = Object.keys(obj[0] || {});
      if (/word|ocr|text|spot|char/i.test(JSON.stringify(k0).slice(0, 200))) {
        console.log(`ARRAY@ ${path} len=${obj.length} itemKeys=${JSON.stringify(k0)}`);
        console.log('   sample:', JSON.stringify(obj[0]).slice(0, 300));
      }
    }
    for (let i = 0; i < Math.min(obj.length, 2); i++) scan(obj[i], `${path}[${i}]`, depth + 1);
  } else if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      if (/word|spot|ocr|text|poly|bbox|cell|line|par/i.test(k)) {
        scan(obj[k], `${path}.${k}`, depth + 1);
      }
    }
  }
}
scan(page, 'page', 0);
// 兜底：打印整页的前面一段
console.log('===== 全量样例(前1500) =====');
console.log(JSON.stringify(page).slice(0, 1500));