import "dotenv/config";
import { ImageGenerationClient, Config } from "coze-coding-dev-sdk";

const client = new ImageGenerationClient(new Config());

async function main() {
  try {
    const responses = await client.batchGenerate([
      { prompt: "A cute cat sitting on a sofa", size: "2K" },
      { prompt: "A dog running in the park", size: "2K" },
    ]);
    console.log("Responses count:", responses.length);
    for (let i = 0; i < responses.length; i++) {
      const helper = client.getResponseHelper(responses[i]);
      console.log(`Item ${i}: success=${helper.success}, urls=${helper.imageUrls.length}`);
    }
  } catch (err: any) {
    console.error("Error:", err.message);
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Data:", JSON.stringify(err.response.data, null, 2));
    }
  }
}

main();
