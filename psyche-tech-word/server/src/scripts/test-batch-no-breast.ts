import "dotenv/config";
import { ImageGenerationClient, Config } from "coze-coding-dev-sdk";

const client = new ImageGenerationClient(new Config());

async function main() {
  try {
    const examples = [
      "The audience gave loud applause.",
      "She placed the book on the wooden chest.",
      "The scientist entered the research chamber.",
    ];
    const requests = examples.map((ex) => ({
      prompt: `Educational illustration depicting this scene: "${ex}". Simple, clear, cartoon or realistic style, no text or letters in the image, suitable for language learning app.`,
      size: "2K" as const,
    }));
    const responses = await client.batchGenerate(requests);
    console.log("Success! Responses:", responses.length);
    for (let i = 0; i < responses.length; i++) {
      const helper = client.getResponseHelper(responses[i]);
      console.log(`  ${i}: success=${helper.success}, urls=${helper.imageUrls.length}`);
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
