const fs = require('fs');
const path = require('path');

// 读取 wordbook_1.json 文件
const dataPath = path.join(__dirname, 'psyche-tech-word', 'client', 'assets', 'data', 'wordbook_1.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log(`-- Found ${data.length} words\n`);

// 生成 INSERT SQL 语句
let sql = `-- Insert ${data.length} words into abcd table\n\n`;

data.forEach((item, index) => {
  // 转义单引号
  const word = item.word ? item.word.replace(/'/g, "''") : '';
  const phonetic = item.phonetic ? item.phonetic.replace(/'/g, "''") : '';
  const meaning = item.meaning ? item.meaning.replace(/'/g, "''") : '';
  const example = item.example ? item.example.replace(/'/g, "''") : '';
  const exampleTranslation = item.example_translation ? item.example_translation.replace(/'/g, "''") : '';
  
  // 我们将 meaning 放到 translation 字段，example 和 example_translation 可以放到 detail 字段
  const detail = example || exampleTranslation ? 
    JSON.stringify({ example, example_translation: exampleTranslation }).replace(/'/g, "''") : '';
  
  sql += `INSERT INTO abcd (word, phonetic, translation, detail) VALUES ('${word}', '${phonetic}', '${meaning}', '${detail}');\n`;
});

// 写入到 SQL 文件
const outputPath = path.join(__dirname, 'insert-abcd.sql');
fs.writeFileSync(outputPath, sql);

console.log(`SQL generated at: ${outputPath}`);
console.log(`\nPlease copy the SQL below and run it in Supabase SQL Editor:\n`);
console.log(sql);