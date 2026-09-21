import { readFileSync } from 'fs';
import sharp from 'sharp';
const env=Object.fromEntries(readFileSync('./.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const KEY=env.QWEN_API_KEY, URL=env.QWEN_API_URL.replace(/\/+$/,'');
const img=await sharp('/tmp/q18.png').resize(900,900,{fit:'inside',withoutEnlargement:true}).jpeg({quality:65}).toBuffer();
const b64=img.toString('base64');
const A_sys=`你是专业的题目解析老师。请分析题目图片，输出精炼解答。返回合法JSON（不要代码块、不要任何前后缀），schema：{"questions":[{"subject":"学科","answer":"最终答案","analysis":"简要解析","solution":"解题步骤（完整严谨推导，不要为求简而跳步；逐步推出每个小问最终结论）","tips":"可选","knowledge_points":"必填","core_competency":"必填","difficulty":"必填"}]}。规则：1不要输出题目文本；2公式用$包；3解答严谨肯定，禁止自我纠正/口语化碎念；4analysis精炼,solution完整严谨推导;5换行用\\n转义;6多题全放;7图片不清返回{"error":...}`;
const A_user=`请解析图片中的所有题目，直接返回题目JSON（不要输出题目文本）：{"questions":[{"subject":"学科","answer":"最终答案","analysis":"简要解析","solution":"解题步骤（完整严谨推导，逐步推出每个小问最终结论）","tips":"可选","knowledge_points":"必填","core_competency":"必填","difficulty":"必填"}]}。所有公式用LaTeX加$包裹；答案写全每小问结论。`;
import { createHash } from 'crypto';
async function run(i){
  const t=Date.now();
  const r=await fetch(`${URL}/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${KEY}`},body:JSON.stringify({model:'qwen3.8-flash',messages:[{role:'system',content:A_sys},{role:'user',content:[{type:'image_url',image_url:{url:`data:image/jpeg;base64,${b64}`}},{type:'text',text:A_user}]}],temperature:0.3})});
  const j=await r.json(); const c=j.choices?.[0]?.message?.content||''; const ms=Date.now()-t;
  // 从JSON里找answer
  let ans='';
  try{ const parsed=JSON.parse(c.replace(/```json|```/g,'')); ans=parsed.questions?.[0]?.answer||''; }catch{ ans=c; }
  const has4s3 = /4\\sqrt\s*\{?\s*3|4\\sqrt\{3\}/.test(c);
  const val = c.match(/最小值为\s*\$?\\?\d*\\sqrt\{\d+\}/)||[];
  console.log(`#${i} ${Math.round(ms/1000)}s 含4√3=${has4s3} 末答:`, (val[0]||ans.split('，').pop()||ans.slice(-40)).slice(0,50));
}
for(let i=1;i<=3;i++) await run(i);
