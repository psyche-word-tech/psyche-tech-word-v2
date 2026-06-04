const fs = require('fs');
const https = require('https');

const url = 'https://code.coze.cn/api/sandbox/coze_coding/file/proxy?expire_time=-1&file_path=assets%2Fwords_a_rows.sql&nonce=6cc6a4d9-a20c-4efa-8359-c5187c480958&project_id=7643045255943651343&sign=d0650e592dbfcdce43c3ca9122da4f2c5bd6970bfbda9c6c9a23eb6789168724';

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    let sql = data;
    sql = sql.replace(/INSERT INTO "public"."words_a"/g, 'INSERT INTO mu');
    fs.writeFileSync('/workspace/projects/insert-mu.sql', sql);
    console.log('Generated insert-mu.sql, length:', sql.length);
    console.log('First 500 chars:', sql.substring(0, 500));
  });
}).on('error', (err) => {
  console.error('Error:', err);
});
