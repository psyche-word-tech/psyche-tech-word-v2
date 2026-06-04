import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import {
  ImageGenerationClient,
  VideoGenerationClient,
  Config,
  S3Storage,
} from "coze-coding-dev-sdk";
import axios from "axios";

const supabaseUrl = process.env.COZE_SUPABASE_URL!;
const supabaseKey =
  process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.COZE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const imageClient = new ImageGenerationClient(new Config());
const videoClient = new VideoGenerationClient(new Config());

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

// 10个有动态动作的单词生成视频（作为动图）
const videoWords = new Set([
  "pinch",
  "gut",
  "belly",
  "ankle",
  "foot",
  "footstep",
  "toe",
  "body",
  "bone",
  "muscle",
]);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function uploadMediaFromUrl(
  url: string,
  fileName: string,
  contentType: string
): Promise<string> {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 60000,
  });
  const buffer = Buffer.from(response.data);
  const key = await storage.uploadFile({
    fileContent: buffer,
    fileName,
    contentType,
  });
  const signedUrl = await storage.generatePresignedUrl({
    key,
    expireTime: 2592000, // 30 days
  });
  return signedUrl;
}

async function generateImages(words: any[]) {
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    console.log(`\n[Image] ${i + 1}/${words.length}: ${word.word}`);

    const prompt = `Educational illustration depicting this scene: "${word.example}". Simple, clear, cartoon or realistic style, no text or letters in the image, suitable for language learning app.`;

    try {
      const response = await imageClient.generate({
        prompt,
        size: "2K",
      });
      const helper = imageClient.getResponseHelper(response);

      if (helper.success && helper.imageUrls.length > 0) {
        const imageUrl = helper.imageUrls[0];
        try {
          const signedUrl = await uploadMediaFromUrl(
            imageUrl,
            `word-images/${word.word}_${Date.now()}.png`,
            "image/png"
          );
          const { error: updateError } = await supabase
            .from("words_a")
            .update({ example_image_url: signedUrl })
            .eq("id", word.id);
          if (updateError) {
            console.error(
              `  ✗ ${word.word}: DB update failed - ${updateError.message}`
            );
          } else {
            console.log(`  ✓ ${word.word}: image uploaded`);
          }
        } catch (err: any) {
          console.error(
            `  ✗ ${word.word}: upload failed - ${err.message}`
          );
        }
      } else {
        console.error(
          `  ✗ ${word.word}: generation failed - ${helper.errorMessages.join(
            ", "
          )}`
        );
      }
    } catch (err: any) {
      console.error(`  ✗ ${word.word}: error - ${err.message}`);
    }

    await sleep(1500);
  }
}

async function generateVideos(words: any[]) {
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    console.log(`\n[Video] ${i + 1}/${words.length}: ${word.word}`);

    const prompt = `A short animated scene depicting: "${word.example}". Smooth motion, realistic style, no text or letters, clear action, educational context, 5 seconds.`;

    try {
      const response = await videoClient.videoGeneration(
        [{ type: "text" as const, text: prompt }],
        {
          model: "doubao-seedance-1-5-pro-251215",
          duration: 5,
          ratio: "1:1",
          resolution: "480p",
          generateAudio: false,
          watermark: false,
        }
      );

      if (response.videoUrl) {
        try {
          const signedUrl = await uploadMediaFromUrl(
            response.videoUrl,
            `word-videos/${word.word}_${Date.now()}.mp4`,
            "video/mp4"
          );
          const { error: updateError } = await supabase
            .from("words_a")
            .update({ example_image_url: signedUrl })
            .eq("id", word.id);
          if (updateError) {
            console.error(
              `  ✗ ${word.word}: DB update failed - ${updateError.message}`
            );
          } else {
            console.log(`  ✓ ${word.word}: video uploaded`);
          }
        } catch (err: any) {
          console.error(
            `  ✗ ${word.word}: upload failed - ${err.message}`
          );
        }
      } else {
        console.error(
          `  ✗ ${word.word}: video generation failed - ${
            response.response?.error_message || "unknown"
          }`
        );
      }
    } catch (err: any) {
      console.error(`  ✗ ${word.word}: error - ${err.message}`);
    }

    await sleep(3000);
  }
}

async function main() {
  const offset = parseInt(process.argv[2] || "0", 10);
  const limit = parseInt(process.argv[3] || "50", 10);

  const { data: words, error } = await supabase
    .from("words_a")
    .select("id, word, example, example_image_url")
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error || !words) {
    console.error("Failed to fetch words:", error?.message);
    return;
  }

  console.log(`Batch: offset=${offset}, limit=${limit}, got=${words.length}`);

  // 强制清空这批单词的已有图片
  const ids = words.map((w: any) => w.id);
  if (ids.length > 0) {
    await supabase
      .from("words_a")
      .update({ example_image_url: null })
      .in("id", ids);
    console.log("Cleared existing images for this batch.");
  }

  const imageWords = words.filter((w: any) => !videoWords.has(w.word));
  const videoWordsList = words.filter((w: any) => videoWords.has(w.word));

  console.log(`Images to generate: ${imageWords.length}`);
  console.log(`Videos to generate: ${videoWordsList.length}`);

  if (imageWords.length > 0) {
    await generateImages(imageWords);
  }

  if (videoWordsList.length > 0) {
    await generateVideos(videoWordsList);
  }

  console.log("\nBatch done!");
}

main().catch(console.error);
