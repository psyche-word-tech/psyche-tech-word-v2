import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const content = fs.readFileSync(envPath, 'utf-8');
const env = {};
for (const line of content.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}
const url = env.COZE_SUPABASE_URL;
const key = env.COZE_SUPABASE_SERVICE_ROLE_KEY || env.COZE_SUPABASE_ANON_KEY;
console.log('URL:', url);
const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const r = await client.from('users').select('id, phone, username, password').limit(5);
console.log('users:', JSON.stringify(r.data));
console.log('err:', JSON.stringify(r.error));
const tel = '13995589952';
const r2 = await client.from('users').select('id, phone, username, password').or(`phone.eq.${tel},username.eq.${tel}`);
console.log('TARGET:', JSON.stringify(r2.data));
console.log('TARGETerr:', JSON.stringify(r2.error));