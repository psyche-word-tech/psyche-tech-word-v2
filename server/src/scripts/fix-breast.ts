import "dotenv/config";
import { ImageGenerationClient, Config, S3Storage } from "coze-coding-dev-sdk";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";

const supabase = createClient(
  process.env.COZE_SUPABASE_URL!,
  process.env.COZE_SUPABASE_SERVICE_ROLE_KEY!
);
const imageClient = new ImageGenerationClient(new Config());
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

async function uploadMediaFromUrl(url: string, fileName: string, contentType: string): Promise<string> {
  const response = await axios.get(url, { responseType: "arraybuffer", timeout: 60000 });
  const buffer = Buffer.from(response.data);
  const key = await storage.uploadFile({ fileContent: buffer, fileName, contentType });
  return await storage.generatePresignedUrl({ key, expireTime: 2592000 });
}

async function main() {
  const word = "breast";
  const example = "She covers her breast with a scarf.";

  // 使用更安全的 prompt，避免敏感词
  const prompt = `Educational medical illustration showing a woman covering her upper chest area with a scarf. Simple, clear, modest illustration style, no text or letters, suitable for language learning app.`;

  console.log(`[Image] ${word}: generating with safe prompt...`);

  try {
    const response = await imageClient.generate({ prompt, size: "2K" });
    const helper = imageClient.getResponseHelper(response);

    if (helper.success && helper.imageUrls.length > 0) {
      const imageUrl = helper.imageUrls[0];
      const signedUrl = await uploadMediaFromUrl(
        imageUrl,
        `word-images/${word}_${Date.now()}.png`,
        "image/png"
      );
      const { error: updateError } = await supabase
        .from("words_a")
        .update({ example_image_url: signedUrl })
        .eq("word", word);
      if (updateError) {
        console.error(`  ✗ ${word}: DB update failed - ${updateError.message}`);
      } else {
        console.log(`  ✓ ${word}: image uploaded`);
      }
    } else {
      console.error(`  ✗ ${word}: generation failed - ${helper.errorMessages.join(", ")}`);
    }
  } catch (err: any) {
    console.error(`  ✗ ${word}: error - ${err.message}`);
  }
}

main().catch(console.error);
