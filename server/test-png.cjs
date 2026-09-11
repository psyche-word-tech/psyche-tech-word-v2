const fs = require('fs');
(async () => {
  const file = '/workspace/projects/assets/image_20260907204434260.png';
  const b64 = fs.readFileSync(file).toString('base64');
  const body = { images: [`data:image/png;base64,${b64}`], max_score: 60, lang: 'en', reference_answer: 'balance equilibrium mountain river admiring scenery' };
  const res = await fetch('http://127.0.0.1:5000/api/v1/essay-grading/recording-grade',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const json = await res.json();
  const mi = json.data.marked_images||[];
  console.log('HTTP',res.status,'marked_images len=',mi.length);
  if(mi[0]){ console.log('prefix=',mi[0].slice(0,22)); const b=Buffer.from(mi[0].split(',')[1],'base64'); console.log('bytes=',b.length,'png header=',b.slice(0,8).toString('hex')); fs.writeFileSync('/tmp/rec-marked.png',b); }
})();
