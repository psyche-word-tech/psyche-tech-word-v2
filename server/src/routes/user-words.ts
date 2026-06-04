import express from "express";
import { getSupabaseClient, fetchTableDirectly } from "@/storage/database/supabase-client";
import { clearWordbooksCache } from "@/routes/wordbooks";

const router = express.Router();

interface Word {
  id: number;
  word: string;
  meaning: string | null;
  phonetic: string | null;
  example: string | null;
}

// GET /api/v1/user-words - 获取用户已购词汇列表
router.get('/', async (req, res) => {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('user_words')
      .select(`
        word_id,
        words (id, word, meaning, phonetic, example)
      `)
      .order('purchased_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // 格式化数据
    const words = data?.map((item: any) => item.words).filter(Boolean) || [];
    res.json(words);
  } catch (err) {
    console.error('Error fetching user words:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/user-words/count - 获取用户词汇数量
router.get('/count', async (req, res) => {
  try {
    const client = getSupabaseClient();
    const { count, error } = await client
      .from('user_words')
      .select('*', { count: 'exact', head: true });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({ count });
  } catch (err) {
    console.error('Error counting user words:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/user-words/purchase - 购买词汇
router.post('/purchase', async (req, res) => {
  try {
    const { wordIds, userId = 1 } = req.body;

    if (!wordIds || !Array.isArray(wordIds)) {
      res.status(400).json({ error: 'wordIds is required and must be an array' });
      return;
    }

    const client = getSupabaseClient();

    // 插入用户词汇记录
    const records = wordIds.map((wordId: number) => ({
      word_id: wordId,
      user_id: userId,
    }));

    const { error } = await client.from('user_words').upsert(records, {
      onConflict: 'word_id,user_id',
      ignoreDuplicates: true,
    });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true, message: 'Words purchased successfully' });
  } catch (err) {
    console.error('Error purchasing words:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/user-words/move - 将单词从 words_b 移动到 words_x/y/z
router.post('/move', async (req, res) => {
  try {
    const { wordId, targetTable } = req.body;

    if (!wordId || !targetTable) {
      res.status(400).json({ error: 'wordId and targetTable are required' });
      return;
    }

    // 验证目标表名
    const validTables = ['words_x', 'words_y', 'words_z'];
    if (!validTables.includes(targetTable)) {
      res.status(400).json({ error: 'Invalid target table' });
      return;
    }

    const client = getSupabaseClient();

    // 从 words_b 获取单词详情
    const { data: word, error: fetchError } = await client
      .from('words_b')
      .select('*')
      .eq('id', wordId)
      .single();

    if (fetchError || !word) {
      res.status(404).json({ error: 'Word not found in words_b' });
      return;
    }

    // 插入到目标表
    const { error: insertError } = await client.from(targetTable).insert({
      word: word.word,
      meaning: word.meaning,
      phonetic: word.phonetic,
      example: word.example,
      translation: word.translation,
      image_url: word.image_url,
    });

    if (insertError) {
      res.status(500).json({ error: insertError.message });
      return;
    }

    // 从 words_b 删除
    const { error: deleteError } = await client
      .from('words_b')
      .delete()
      .eq('id', wordId);

    if (deleteError) {
      res.status(500).json({ error: deleteError.message });
      return;
    }

    // 注意：不再从 words_a 删除，words_a 保持完整作为独立数据源

    res.json({ success: true, message: `Word moved to ${targetTable}` });
  } catch (err) {
    console.error('Error moving word:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/user-words/classify - 将单词从 a 表移动到 x/y/z 表
router.post('/classify', async (req, res) => {
  try {
    const { wordId, targetTable } = req.body;

    if (!wordId || !targetTable) {
      res.status(400).json({ error: 'wordId and targetTable are required' });
      return;
    }

    // 验证目标表名
    const validTables = ['x', 'y', 'z'];
    if (!validTables.includes(targetTable)) {
      res.status(400).json({ error: 'Invalid target table' });
      return;
    }

    const client = getSupabaseClient();

    // 使用 RPC 调用 move_word 函数（绕过 schema cache）
    // 确保 word_id 是数字类型（数据库中 id 为 bigint，Supabase JS 可能返回字符串）
    const numericWordId = typeof wordId === 'string' ? parseInt(wordId, 10) : wordId;
    const { data, error } = await client.rpc('move_word', {
      word_id: numericWordId,
      target_table: targetTable,
    });

    if (error) {
      console.error('RPC move_word error:', error);
      res.status(500).json({ error: error.message });
      return;
    }

    if (!data.success) {
      res.status(404).json({ error: data.error });
      return;
    }

    // 清除 wordbooks 缓存，确保已会/模糊/不会列表能立即看到更新
    clearWordbooksCache('words:a');
    clearWordbooksCache(`words:${targetTable}`);

    res.json({ success: true, message: data.message });
  } catch (err) {
    console.error('Error classifying word:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/user-words/category/:table - 获取分类单词列表
router.get('/category/:table', async (req, res) => {
  try {
    const { table } = req.params;

    // 验证表名
    const validTables = ['words_b', 'words_x', 'words_y', 'words_z', 'x1', 'y1', 'z1', 'mu', 'x', 'y', 'z', 'a', 'b', 'c', 'd'];
    if (!validTables.includes(table)) {
      res.status(400).json({ error: 'Invalid table name' });
      return;
    }

    const client = getSupabaseClient();
    let { data, error } = await client
      .from(table)
      .select('*')
      .order('created_at', { ascending: false });

    console.log('DEBUG - table:', table, 'error:', error?.message, 'data length:', data?.length);

    // 如果 schema cache 错误，使用直接 fetch 调用 REST API
    if (error && error.message && error.message.includes('schema cache')) {
      console.log('DEBUG - trying direct fetch for table:', table);
      const directData = await fetchTableDirectly(table);
      console.log('DEBUG - direct fetch result length:', directData?.length);
      data = directData;
      error = null;
    }

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json(data || []);
  } catch (err) {
    console.error('Error fetching category words:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/user-words/category/:table/count - 获取分类单词数量
router.get('/category/:table/count', async (req, res) => {
  try {
    const { table } = req.params;

    // 验证表名
    const validTables = ['words_b', 'words_x', 'words_y', 'words_z', 'x1', 'y1', 'z1', 'mu', 'x', 'y', 'z', 'a', 'b', 'c', 'd'];
    if (!validTables.includes(table)) {
      res.status(400).json({ error: 'Invalid table name' });
      return;
    }

    const client = getSupabaseClient();
    let count = 0;
    let { count: exactCount, error } = await client
      .from(table)
      .select('*', { count: 'exact', head: true });

    // 如果 schema cache 错误，使用 RPC 回退
    if (error && error.message && error.message.includes('schema cache')) {
      const rpcResult = await client.rpc('get_table_data', { table_name: table });
      if (rpcResult.data && Array.isArray(rpcResult.data)) {
        count = rpcResult.data.length;
        error = null;
      }
    } else if (!error && exactCount !== null) {
      count = exactCount;
    }

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ count });
  } catch (err) {
    console.error('Error counting category words:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/user-words/move-mindmap - 将导图单词从源表移动到 x1/y1/z1
router.post('/move-mindmap', async (req, res) => {
  try {
    const { word, sourceTable, targetTable } = req.body;

    if (!word || !sourceTable || !targetTable) {
      res.status(400).json({ error: 'word, sourceTable and targetTable are required' });
      return;
    }

    const validTargets = ['x1', 'y1', 'z1'];
    if (!validTargets.includes(targetTable)) {
      res.status(400).json({ error: 'Invalid target table' });
      return;
    }

    const client = getSupabaseClient();

    // 从源表获取单词详情
    const { data: wordData, error: fetchError } = await client
      .from(sourceTable)
      .select('*')
      .eq('word', word)
      .single();

    if (fetchError || !wordData) {
      res.status(404).json({ error: 'Word not found in source table' });
      return;
    }

    // 检查目标表是否已存在该单词
    const { data: existing, error: existingError } = await client
      .from(targetTable)
      .select('id')
      .eq('word', wordData.word)
      .single();

    if (existing) {
      // 已存在则更新
      const { error: updateError } = await client
        .from(targetTable)
        .update({
          meaning: wordData.meaning,
          phonetic: wordData.phonetic,
          example: wordData.example,
          translation: wordData.translation,
          example_translation: wordData.example_translation,
          example_image_url: wordData.example_image_url,
          example_audio_url: wordData.example_audio_url,
          noun_phrase: wordData.noun_phrase,
        })
        .eq('word', wordData.word);

      if (updateError) {
        res.status(500).json({ error: updateError.message });
        return;
      }
    } else {
      // 不存在则插入
      const { error: insertError } = await client.from(targetTable).insert({
        word: wordData.word,
        meaning: wordData.meaning,
        phonetic: wordData.phonetic,
        example: wordData.example,
        translation: wordData.translation,
        example_translation: wordData.example_translation,
        example_image_url: wordData.example_image_url,
        example_audio_url: wordData.example_audio_url,
        noun_phrase: wordData.noun_phrase,
      });

      if (insertError) {
        res.status(500).json({ error: insertError.message });
        return;
      }
    }

    // 从其他两个分类表中删除该单词（实现"改变分类"功能）
    const otherTables = validTargets.filter((t: string) => t !== targetTable);
    for (const otherTable of otherTables) {
      const { error: deleteError } = await client
        .from(otherTable)
        .delete()
        .eq('word', wordData.word);
      if (deleteError) {
        console.error(`Error deleting from ${otherTable}:`, deleteError.message);
      }
    }

    // 注意：不从源表删除，111 表单词数量保持不变
    res.json({ success: true, message: `Word moved to ${targetTable} successfully` });
  } catch (err) {
    console.error('Error moving mindmap word:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/user-words/mindmap-counts - 获取 x1/y1/z1 的单词数量
router.get('/mindmap-counts', async (req, res) => {
  try {
    const client = getSupabaseClient();

    const tables = ['x1', 'y1', 'z1'];
    const counts: Record<string, number> = {};

    for (const table of tables) {
      const { count, error } = await client
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      counts[table] = count || 0;
    }

    res.json(counts);
  } catch (err) {
    console.error('Error counting mindmap words:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
