import express from 'express';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const router = express.Router();

// GET /api/v1/mindmap - 获取所有思维导图词汇
router.get('/', async (req, res) => {
  try {
    const client = getSupabaseClient(); // 使用 service role key 直接连接数据库
    const { data, error } = await client
      .from('mindmap_111')
      .select('*')
      .order('id');

    if (error) {
      console.error('Mindmap query error:', error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ data });
  } catch (err) {
    console.error('Error fetching mindmap:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/mindmap/categories - 获取所有分类
router.get('/categories', async (req, res) => {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('mindmap_111')
      .select('category')
      .order('category');

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // 去重
    const categories = [...new Set(data?.map(item => item.category) || [])];
    res.json({ data: categories });
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/mindmap/:category - 按分类获取词汇
router.get('/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('mindmap_words')
      .select('*')
      .eq('category', category)
      .order('id');

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ data });
  } catch (err) {
    console.error('Error fetching mindmap by category:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
