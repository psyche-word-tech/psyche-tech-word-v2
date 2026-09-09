import { PaddleOCRClient, Model } from '@paddleocr/api-sdk';
import fs from 'fs';

const env = fs.readFileSync('/workspace/projects/server/.env', 'utf8');
const token = (env.match(/PADDLEOCR_ACCESS_TOKEN=(.*)/) || [])[1]?.trim();
const client = new PaddleOCRClient({ token, requestTimeout: 60000, pollTimeout: 120000 });

async function probe(name, model, options) {
  try {
    const r = await client.ocr({ filePath: '/tmp/paddleocr_1788944564377.jpg', model, options });
    const page = r.pages?.[0];
    const pruned = page?.prunedResult || page?.raw?.prunedResult;
    const keys = Object.keys(pruned || {});
    console.log(`\n### ${name}  keys:`, JSON.stringify(keys));
    // 找词/字符级候选字段
    for (const k of keys) {
      const v = pruned[k];
      if (/word|char|poly|cell|block|spot|box|dt_|rec_/i.test(k)) {
        const dim = Array.isArray(v) ? `array@` : (v && typeof v === 'object' ? 'obj' : typeof v);
        let extra = '';
        if (Array.isArray(v)) extra = `len=${v.length} [0]=${JSON.stringify(v[0]).slice(0, 120)}`;
        console.log(`   - ${k}: ${dim} ${extra}`);
      }
    }
    // 也看 pruned 上层结构
    console.log('   page keys:', Object.keys(page || {}).join(','));
  } catch (e) {
    console.log(`\n### ${name} ERROR:`, (e.message || '').slice(0, 200));
  }
}

await probe('PPOCRv6', Model.PPOCRv6, { return_word_box: true, textDetUnclipRatio: 1.3 });
await probe('PP-StructureV3', Model.PPStructureV3, { layoutShapeMode: 'quad', outputFormats: ['json', 'html'] });
await probe('PaddleOCR-VL-1.6', Model.PaddleOCRVL16, { layoutShapeMode: 'quad', outputFormats: ['json'], promptLabel: 'spotting', maxNewTokens: 3000 });