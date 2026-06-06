import express from 'express';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const router = express.Router();

// 直接执行 SQL 查询，绕过 PostgREST schema cache
async function querySQL(sql: string): Promise<any[]> {
  const client = getSupabaseClient();
  // 使用 rpc 调用自定义函数来执行 SQL（如果支持）
  // 或者直接使用 supabase 客户端查询已存在的表
  const { data, error } = await client.rpc('exec', { sql_query: sql }).catch(() => null);
  if (error || !data) {
    // 降级方案：使用 REST API 直接查询
    const response = await fetch(
      `${process.env.COZE_SUPABASE_URL}/rest/v1/mindmap_v?select=*&order=id.asc`,
      {
        headers: {
          'apikey': process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || '',
          'Authorization': `Bearer ${process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || ''}`,
        }
      }
    );
    if (response.ok) {
      return await response.json();
    }
    return [];
  }
  return data;
}

// GET /api/v1/mindmap_v - 获取所有思维导图词汇
router.get('/', async (req, res) => {
  try {
    // 使用 Supabase REST API 直接查询，绕过 schema cache
    const response = await fetch(
      `${process.env.COZE_SUPABASE_URL || 'https://hmkkynldaiypuhhlpjxd.supabase.co'}/rest/v1/mindmap_v?select=*&order=id.asc`,
      {
        headers: {
          'apikey': process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhta2t5bmxkYWl5cHVoaGxwanhkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAyNTQxMywiZXhwIjoyMDkyNjAxNDEzfQ.lDYVf0H2OK_Z7nmDYybHC93DtDroD5m8eRJpE25776o',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhta2t5bmxkYWl5cHVoaGxwanhkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAyNTQxMywiZXhwIjoyMDkyNjAxNDEzfQ.lDYVf0H2OK_Z7nmDYybHC93DtDroD5m8eRJpE25776o`,
          'Content-Type': 'application/json',
        }
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('REST API error:', response.status, errorText);
      res.status(response.status).json({ error: errorText });
      return;
    }
    
    const data = await response.json();
    res.json({ data });
  } catch (err) {
    console.error('Error fetching mindmap_v:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/mindmap_v/categories - 获取所有分类
router.get('/categories', async (req, res) => {
  try {
    // 使用 Supabase REST API 直接查询
    const response = await fetch(
      `${process.env.COZE_SUPABASE_URL || 'https://hmkkynldaiypuhhlpjxd.supabase.co'}/rest/v1/mindmap_v?select=category&order=category.asc`,
      {
        headers: {
          'apikey': process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhta2t5bmxkYWl5cHVoaGxwanhkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAyNTQxMywiZXhwIjoyMDkyNjAxNDEzfQ.lDYVf0H2OK_Z7nmDYybHC93DtDroD5m8eRJpE25776o',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhta2t5bmxkYWl5cHVoaGxwanhkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAyNTQxMywiZXhwIjoyMDkyNjAxNDEzfQ.lDYVf0H2OK_Z7nmDYybHC93DtDroD5m8eRJpE25776o`,
          'Content-Type': 'application/json',
        }
      }
    );
    
    if (!response.ok) {
      res.status(response.status).json({ error: await response.text() });
      return;
    }
    
    const data = await response.json();
    // 去重
    const categories = [...new Set(data?.map((item: any) => item.category) || [])];
    res.json({ data: categories });
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/mindmap_v/:category - 按分类获取词汇
router.get('/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('mindmap_v_words')
      .select('*')
      .eq('category', category)
      .order('id');

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ data });
  } catch (err) {
    console.error('Error fetching mindmap_v by category:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
