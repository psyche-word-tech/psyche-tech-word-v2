const fs=require('fs');
const image=fs.readFileSync('essay-base64.txt','utf8').trim();
fetch('http://localhost:5000/api/v1/essay-grading/grade',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image,reference_answer:'自动生成',max_score:15})})
.then(r=>r.json()).then(j=>{
  if(j.success&&j.data.marked_image){
    const b64=j.data.marked_image.split(',')[1]||j.data.marked_image;
    fs.writeFileSync('/tmp/marked.png',Buffer.from(b64,'base64'));
    console.log('saved marked.png', fs.statSync('/tmp/marked.png').size);
  }else{console.log('ERR',j.error)}
}).catch(e=>console.log(e.message));
