import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function importData() {
  console.log('Starting data import to abcd table...');

  const supabaseUrl = process.env.COZE_SUPABASE_URL || '';
  const supabaseKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Read data file
  const dataPath = path.join(__dirname, 'psyche-tech-word', 'client', 'assets', 'data', 'wordbook_1.json');
  
  if (!fs.existsSync(dataPath)) {
    console.error('Data file not found:', dataPath);
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  
  if (rawData.error) {
    console.error('Error in data file:', rawData.error);
    process.exit(1);
  }

  const words = rawData.data || [];
  console.log(`Read ${words.length} words from data file`);

  // Clear existing data
  console.log('Clearing existing data from abcd table...');
  await supabase.from('abcd').delete().neq('id', 0);

  // Insert data in batches
  const batchSize = 50;
  let insertedCount = 0;

  for (let i = 0; i < words.length; i += batchSize) {
    const batch = words.slice(i, i + batchSize);
    
    const insertData = batch.map(word => ({
      word: word.word,
      phonetic: word.phonetic,
      translation: word.translation,
      detail: JSON.stringify(word.detail || {})
    }));

    console.log(`Inserting batch ${Math.floor(i/batchSize) + 1} (${insertData.length} words)...`);
    
    const { error } = await supabase.from('abcd').insert(insertData);
    
    if (error) {
      console.error('Error inserting batch:', error.message);
      process.exit(1);
    }

    insertedCount += insertData.length;
    console.log(`Inserted ${insertedCount}/${words.length} words`);
  }

  // Verify
  console.log('\nVerifying import...');
  const { data: abcdData, error: verifyError } = await supabase.from('abcd').select('*');
  
  if (verifyError) {
    console.error('Verification error:', verifyError.message);
    process.exit(1);
  }

  console.log(`\n✅ Success! Imported ${abcdData?.length || 0} words into abcd table`);
  console.log('Data import completed!');
}

importData().catch(console.error);