const fs = require('fs');
(async () => {
  const file = '/workspace/projects/assets/image_20260907204434260.png';
  const b64 = fs.readFileSync(file).toString('base64');
  const body = { images: [`data:image/png;base64,${b64}`], max_score: 60, lang: 'en', reference_answer: 'balance equilibrium mountain' };
  const res = await fetch('http://127.0.0.1:5000/api/v1/essay-grading/recording-grade',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const json = await res.json();
  if(!json.success){console.log('ERR',json.error);process.exit(0);}
  const mi = json.data.marked_images||[];
  console.log('marked_images len=',mi.length);
  if(mi[0]){ const b=Buffer.from(mi[0].split(',')[1],'base64'); fs.writeFileSync('/tmp/rec-marked2.jpg',b); console.log('saved /tmp/rec-marked2.jpg bytes=',b.length); }
})();
