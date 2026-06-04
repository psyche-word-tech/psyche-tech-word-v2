import { Router } from 'express';
import { ImageGenerationClient, Config } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const router = Router();
const config = new Config();
const imageClient = new ImageGenerationClient(config);

// 为单个单词生成例句图片
router.post('/generate-example-image/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const client = getSupabaseClient();
    
    // 获取单词信息
    const { data: word, error } = await client
      .from('words_a')
      .select('id, word, example, example_translation')
      .eq('id', id)
      .single();
    
    if (error || !word) {
      return res.status(404).json({ error: 'Word not found' });
    }
    
    if (!word.example) {
      return res.status(400).json({ error: 'No example sentence found' });
    }
    
    // 生成图片提示词
    const prompt = `An illustration for the English sentence: "${word.example}" (${word.example_translation}). The image should be simple, clean, and educational. Style: minimalist, warm colors, suitable for language learning app. No text in the image.`;
    
    // 生成图片
    const response = await imageClient.generate({
      prompt,
      size: '2K',
      watermark: false,
    });
    
    const helper = imageClient.getResponseHelper(response);
    
    if (!helper.success) {
      console.error('Image generation failed:', helper.errorMessages);
      return res.status(500).json({ error: 'Image generation failed', details: helper.errorMessages });
    }
    
    const imageUrl = helper.imageUrls[0];
    
    // 更新数据库
    await client
      .from('words_a')
      .update({ example_image_url: imageUrl })
      .eq('id', id);
    
    res.json({ success: true, imageUrl });
  } catch (error: any) {
    console.error('Error generating image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 批量生成所有单词的例句图片
router.post('/generate-all-example-images', async (req, res) => {
  try {
    const client = getSupabaseClient();
    
    // 获取所有没有图片的单词
    const { data: words, error } = await client
      .from('words_a')
      .select('id, word, example, example_translation')
      .not('example', 'is', null)
      .or('example_image_url.is.null,example_image_url.eq.');
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    const results: { id: number; word: string; success: boolean; imageUrl?: string; error?: string }[] = [];
    
    for (const word of words || []) {
      try {
        // 生成图片提示词
        const prompt = `An illustration for the English sentence: "${word.example}". Chinese meaning: ${word.example_translation}. Simple, clean, educational illustration. Style: minimalist, warm colors, suitable for language learning. No text.`;
        
        const response = await imageClient.generate({
          prompt,
          size: '2K',
          watermark: false,
        });
        
        const helper = imageClient.getResponseHelper(response);
        
        if (helper.success) {
          const imageUrl = helper.imageUrls[0];
          await client
            .from('words_a')
            .update({ example_image_url: imageUrl })
            .eq('id', word.id);
          results.push({ id: word.id, word: word.word, success: true, imageUrl });
          console.log(`✓ Generated image for: ${word.word}`);
        } else {
          results.push({ id: word.id, word: word.word, success: false, error: helper.errorMessages?.[0] });
          console.log(`✗ Failed for: ${word.word}`);
        }
        
        // 避免请求过快
        await new Promise(r => setTimeout(r, 1500));
      } catch (error: any) {
        results.push({ id: word.id, word: word.word, success: false, error: error.message });
        console.log(`✗ Error for: ${word.word}`);
      }
    }
    
    res.json({ 
      total: words?.length || 0,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results 
    });
  } catch (error: any) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
