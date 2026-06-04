import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getObjectStorageClient } from '@/storage/object-storage/client';
import { tts } from '@/ai/tts';

const BUCKET_NAME = 'coze_storage_7630677478465568811';
const OBJECT_KEY_PREFIX = 'word-audio';

async function regenerateGutAudio() {
  console.log('开始重新生成 gut 单词例句音频...');

  const supabaseClient = getSupabaseClient();
  const objectStorageClient = getObjectStorageClient();

  // 获取 gut 单词
  const { data: gutWord, error: fetchError } = await supabaseClient
    .from('words_b')
    .select('*')
    .eq('word', 'gut')
    .single();

  if (fetchError) {
    console.error('获取 gut 单词失败:', fetchError);
    return;
  }

  console.log('找到 gut 单词:', gutWord.word);
  console.log('例句:', gutWord.example);

  // 使用 TTS 生成音频
  const exampleText = gutWord.example || 'The chef guts the fish quickly';
  console.log('开始生成 TTS 音频...');

  const audioBuffer = await tts.textToSpeech({
    text: exampleText,
    voice: 'zh-CN-XiaoxiaoNeural', // 使用英文发音
    speed: 0.9
  });

  console.log('TTS 音频生成完成，大小:', audioBuffer.length, 'bytes');

  // 上传到对象存储
  const timestamp = Date.now();
  const objectKey = `${OBJECT_KEY_PREFIX}/gut-example-${timestamp}.mp3`;

  console.log('正在上传到对象存储...');
  console.log('Bucket:', BUCKET_NAME);
  console.log('Object key:', objectKey);

  const uploadResult = await objectStorageClient.putObject({
    bucketName: BUCKET_NAME,
    objectKey: objectKey,
    body: audioBuffer,
    contentType: 'audio/mpeg'
  });

  console.log('上传成功:', uploadResult);

  // 获取预签名 URL
  const signedUrl = await objectStorageClient.presignGetObject({
    bucketName: BUCKET_NAME,
    objectKey: objectKey,
    expiresInSeconds: 3600 * 24 * 365 // 1年有效期
  });

  console.log('预签名 URL 生成成功:', signedUrl);

  // 更新数据库
  const { error: updateError } = await supabaseClient
    .from('words_b')
    .update({ example_audio_url: signedUrl })
    .eq('id', gutWord.id);

  if (updateError) {
    console.error('更新数据库失败:', updateError);
    return;
  }

  console.log('✓ gut 单词例句音频重新生成成功！');
  console.log('新的 audio URL:', signedUrl);

  // 同步更新 words_a 表
  const { error: updateAError } = await supabaseClient
    .from('words_a')
    .update({ example_audio_url: signedUrl })
    .eq('word', 'gut');

  if (updateAError) {
    console.error('更新 words_a 表失败:', updateAError);
  } else {
    console.log('✓ words_a 表也已同步更新');
  }
}

regenerateGutAudio().catch(console.error);
