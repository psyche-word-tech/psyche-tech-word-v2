import express from 'express';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const router = express.Router();

interface Word {
  id: number;
  word: string;
  meaning: string | null;
  phonetic: string | null;
  example: string | null;
}

// 获取单词列表
router.get('/', async (req, res) => {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.from('words').select('id, word, meaning, phonetic, example').order('id');
    
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    
    res.json({ data: data as Word[] });
  } catch (err) {
    console.error('Error fetching words:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取单个单词
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const client = getSupabaseClient();
    const { data, error } = await client.from('words').select('id, word, meaning, phonetic, example').eq('id', parseInt(id)).maybeSingle();
    
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    
    if (!data) {
      res.status(404).json({ error: 'Word not found' });
      return;
    }
    
    res.json({ data: data as Word });
  } catch (err) {
    console.error('Error fetching word:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 更新单词状态 (x=已会, y=模糊, z=不会)
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['x', 'y', 'z'].includes(status)) {
      res.status(400).json({ error: 'Invalid status. Must be x, y, or z.' });
      return;
    }

    const client = getSupabaseClient();
    
    // 先删除旧状态
    await client.from('word_status').delete().eq('word_id', parseInt(id));
    
    // 插入新状态
    const { data, error } = await client.from('word_status').insert({
      word_id: parseInt(id),
      status: status
    }).select();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    
    res.json({ success: true, data: { wordId: parseInt(id), status } });
  } catch (err) {
    console.error('Error updating word status:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取所有单词状态（批量）
router.get('/statuses/all', async (req, res) => {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.from('word_status').select('word_id, status');
    
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    
    // 转换为 { wordId: status } 的映射
    const statusMap: Record<number, string> = {};
    data.forEach((item: { word_id: number; status: string }) => {
      statusMap[item.word_id] = item.status;
    });
    
    res.json({ data: statusMap });
  } catch (err) {
    console.error('Error fetching all statuses:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取单词状态
router.get('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const client = getSupabaseClient();
    const { data, error } = await client.from('word_status').select('status').eq('word_id', parseInt(id)).maybeSingle();
    
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    
    res.json({ data: data ? { wordId: parseInt(id), status: data.status } : null });
  } catch (err) {
    console.error('Error fetching word status:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取所有状态分类统计
router.get('/stats/summary', async (req, res) => {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.from('word_status').select('status');
    
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    
    const stats = { x: 0, y: 0, z: 0 };
    data.forEach((item: { status: string }) => {
      if (stats.hasOwnProperty(item.status)) {
        stats[item.status as keyof typeof stats]++;
      }
    });
    
    res.json({ data: stats });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
