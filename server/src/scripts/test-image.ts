import "dotenv/config";
import { ImageGenerationClient, Config } from "coze-coding-dev-sdk";

const client = new ImageGenerationClient(new Config());

async function main() {
  try {
    const response = await client.generate({
      prompt: "A cute cat sitting on a sofa",
      size: "2K",
    });
    console.log("Response:", JSON.stringify(response, null, 2));
    const helper = client.getResponseHelper(response);
    console.log("Success:", helper.success);
    console.log("URLs:", helper.imageUrls);
    console.log("Errors:", helper.errorMessages);
  } catch (err: any) {
    console.error("Error:", err.message);
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Data:", JSON.stringify(err.response.data, null, 2));
    }
  }
}

main();
