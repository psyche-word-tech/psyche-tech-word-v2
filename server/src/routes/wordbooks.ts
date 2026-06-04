import express from 'express';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const router = express.Router();



const VALID_TABLES = ['words_a', 'words_b', 'words_c', 'words_d', 'words_x', 'words_y', 'words_z', 'x1', 'y1', 'z1', '111', 'a', 'b', 'c', 'd', 'x', 'y', 'z'];
const VALID_TABLES_MOVE = ['words_a', 'words_b', 'words_c', 'words_d', 'words_x', 'words_y', 'words_z', 'x1', 'y1', 'z1', 'a', 'b', 'c', 'd', 'x', 'y', 'z'];
const VALID_TABLES_COUNT = ['words_a', 'words_b', 'words_c', 'words_d', 'words_x', 'words_y', 'words_z', 'x1', 'y1', 'z1', 'user_words', 'a', 'b', 'c', 'd', 'x', 'y', 'z'];

// 保留空函数以兼容旧代码引用
export function clearWordbooksCache(table: string) {
  // no-op: caching removed
}

/**
 * GET /api/v1/wordbooks
 * 获取所有词汇书列表
 */
// 硬编码词汇书数据（绕过 PostgREST schema cache 问题）
const WORDBOOKS_DATA = [
  { id: 1, name: '高中词汇', purchased: true },
  { id: 2, name: '四级词汇', purchased: true },
  { id: 3, name: '六级词汇', purchased: true },
  { id: 4, name: '考研词汇', purchased: true },
];

router.get('/', async (req, res) => {
  try {
    res.json(WORDBOOKS_DATA);
  } catch (error: any) {
    console.error('Error fetching wordbooks:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/wordbooks/stats
 * 获取学习进度统计（已会/模糊/不会/待学习）
 */
router.get('/stats', async (req, res) => {
  try {
    const client = getSupabaseClient();
    const tables = ['a', 'x', 'y', 'z'];
    const labels = ['learning', 'known', 'vague', 'unknown'];

    // 并行查询所有表
    const results = await Promise.all(
      tables.map((table) =>
        client
          .from(table)
          .select('*', { count: 'exact', head: true })
          .then(({ count, error }) => ({ count: count || 0, error }))
      )
    );

    const stats: Record<string, number> = {};
    results.forEach((result, i) => {
      if (result.error) {
        console.error(`Error counting ${tables[i]}:`, result.error);
      }
      stats[labels[i]] = result.count;
    });

    res.json({
      learning: stats.learning || 0,
      known: stats.known || 0,
      vague: stats.vague || 0,
      unknown: stats.unknown || 0,
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/wordbooks/purchase
 * 购买词汇书：将源数据库的单词复制到目标数据库
 */
router.post('/purchase', async (req, res) => {
  try {
    const { sourceTable, targetTable } = req.body;

    if (!VALID_TABLES_MOVE.includes(sourceTable) || !VALID_TABLES_MOVE.includes(targetTable)) {
      res.status(400).json({ error: 'Invalid table name' });
      return;
    }

    // 禁止从 words_a 复制到 words_b（切断联系）
    if (sourceTable === 'words_a' && targetTable === 'words_b') {
      res.status(403).json({ error: 'Copying from words_a to words_b is not allowed.' });
      return;
    }

    const client = getSupabaseClient();

    // 清空目标表
    await client.from(targetTable).delete().neq('id', 0);

    // 从源表获取所有单词
    const { data: sourceWords, error: fetchError } = await client
      .from(sourceTable)
      .select('*');

    if (fetchError) {
      res.status(500).json({ error: fetchError.message });
      return;
    }

    if (!sourceWords || sourceWords.length === 0) {
      res.status(404).json({ error: 'No words found in source table' });
      return;
    }

    // 准备插入数据（移除 id 让数据库自动生成）
    const wordsToInsert = sourceWords.map(({ id, ...rest }) => rest);

    // 插入到目标表
    const { data: insertedWords, error: insertError } = await client
      .from(targetTable)
      .insert(wordsToInsert)
      .select();

    if (insertError) {
      res.status(500).json({ error: insertError.message });
      return;
    }

    res.json({
      success: true,
      message: `Successfully copied ${insertedWords?.length || 0} words from ${sourceTable} to ${targetTable}`,
      copiedCount: insertedWords?.length || 0
    });
  } catch (err) {
    console.error('Error purchasing wordbook:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/wordbooks/copy
 * 复制词汇书
 */
router.post('/copy', async (req, res) => {
  try {
    const { sourceTable, targetTable, bookId } = req.body;

    if (sourceTable === 'words_a' && targetTable === 'words_b') {
      res.status(403).json({ error: 'Copying from words_a to words_b is not allowed.' });
      return;
    }

    const validCopyTables = ['words_a', 'words_b', 'words_c', 'words_d', 'words_e', 'x1', 'y1', 'z1'];
    if (!validCopyTables.includes(sourceTable) || !validCopyTables.includes(targetTable)) {
      res.status(400).json({ error: 'Invalid table name' });
      return;
    }

    const client = getSupabaseClient();

    const { data: sourceWords, error: fetchError } = await client
      .from(sourceTable)
      .select('*');

    if (fetchError) {
      res.status(500).json({ error: fetchError.message });
      return;
    }

    if (!sourceWords || sourceWords.length === 0) {
      res.status(404).json({ error: 'No words found in source table' });
      return;
    }

    await client.from(targetTable).delete().neq('id', 0);

    const wordsToInsert = sourceWords.map(({ id, ...rest }) => rest);

    const { data: insertedWords, error: insertError } = await client
      .from(targetTable)
      .insert(wordsToInsert)
      .select();

    if (insertError) {
      res.status(500).json({ error: insertError.message });
      return;
    }

    if (bookId) {
      await client
        .from('wordbooks')
        .update({ purchased: true })
        .eq('id', bookId);
    }

    res.json({
      success: true,
      message: `Successfully copied ${insertedWords?.length || 0} words`,
      copiedCount: insertedWords?.length || 0
    });
  } catch (err) {
    console.error('Error copying wordbook:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/wordbooks/move
 * 将单词移动到目标表
 */
router.post('/move', async (req, res) => {
  try {
    const { sourceTable, targetTable, wordId } = req.body;

    if (!VALID_TABLES_MOVE.includes(sourceTable) || !VALID_TABLES_MOVE.includes(targetTable)) {
      res.status(400).json({ error: 'Invalid table name' });
      return;
    }

    if (!wordId) {
      res.status(400).json({ error: 'Word ID is required' });
      return;
    }

    const client = getSupabaseClient();

    const { data: word, error: fetchError } = await client
      .from(sourceTable)
      .select('*')
      .eq('id', wordId)
      .maybeSingle();

    if (fetchError) {
      res.status(500).json({ error: fetchError.message });
      return;
    }

    if (!word) {
      res.status(404).json({ error: 'Word not found' });
      return;
    }

    const { id, ...wordData } = word;

    const { error: insertError } = await client
      .from(targetTable)
      .insert(wordData);

    if (insertError) {
      res.status(500).json({ error: insertError.message });
      return;
    }

    await client.from(sourceTable).delete().eq('id', wordId);

    res.json({ success: true, message: `Word moved to ${targetTable}` });
  } catch (err) {
    console.error('Error moving word:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/wordbooks/:table/count
 * 获取指定词汇表的单词数量
 * NOTE: 必须放在 /:table 之前！
 */
router.get('/:table/count', async (req, res) => {
  const table = req.params.table;
  const tableWhitelist = ['mu', 'x', 'y', 'z', 'a', 'b', 'c', 'd'];
  if (!tableWhitelist.includes(table)) {
    res.status(400).json({ error: 'Invalid table name' });
    return;
  }

  try {
    const client = getSupabaseClient();
    const { count, error } = await client
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error(`Error counting table ${table}:`, error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({ table, count: count || 0 });
  } catch (error: any) {
    console.error(`Error counting table ${table}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/wordbooks/:table
 * 获取指定词汇表的所有单词
 * NOTE: 动态路由放在最后！
 */
router.get('/:table', async (req, res) => {
  try {
    const { table } = req.params;

    if (!VALID_TABLES.includes(table)) {
      res.status(400).json({ error: 'Invalid table name' });
      return;
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from(table)
      .select('*');

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json(data || []);
  } catch (err) {
    console.error('Error fetching words:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
