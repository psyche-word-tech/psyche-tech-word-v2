
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { TTSClient, Config } from "coze-coding-dev-sdk";
import { S3Storage } from "coze-coding-dev-sdk";
import axios from "axios";

const supabase = createClient(
  process.env.COZE_SUPABASE_URL!,
  process.env.COZE_SUPABASE_SERVICE_ROLE_KEY!
);
const ttsConfig = new Config();
const ttsClient = new TTSClient(ttsConfig);
const storage = new S3Storage();

async function main() {
  console.log("Fetching gut word...");
  const { data: wordData, error: fetchError } = await supabase
    .from("words_a")
    .select("id, word, example, example_translation")
    .eq("word", "gut")
    .single();

  if (fetchError || !wordData) {
    console.error("Failed to fetch word:", fetchError);
    return;
  }

  console.log(`Generating audio for: "${wordData.example}"`);

  // 使用支持中英文的语音
  const ttsResponse = await ttsClient.synthesize({
    uid: "word-gut",
    text: wordData.example,
    speaker: "zh_female_vv_uranus_bigtts",
    audioFormat: "mp3",
    sampleRate: 24000,
    speechRate: 0,
  });

  console.log("TTS generated:", ttsResponse.audioUri);

  // 下载音频
  const audioBuffer = await axios.get(ttsResponse.audioUri, {
    responseType: "arraybuffer",
  });

  // 上传到对象存储
  const key = `word-audio/gut-example-${Date.now()}.mp3`;
  await storage.uploadFile({
    key,
    content: audioBuffer.data,
    contentType: "audio/mpeg",
  });

  // 获取签名 URL (30天有效期)
  const expiration = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const audioUrl = await storage.generatePresignedUrl({
    key,
    expiresAt: expiration,
  });

  // 更新数据库
  await supabase
    .from("words_a")
    .update({ example_audio_url: audioUrl })
    .eq("id", wordData.id);

  console.log("Success! Audio URL:", audioUrl);
}

main().catch((err) => console.error(err));
