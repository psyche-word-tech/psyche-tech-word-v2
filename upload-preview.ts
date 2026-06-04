import { S3Storage } from "coze-coding-dev-sdk";
import * as fs from "fs";

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

async function main() {
  const content = fs.readFileSync("/workspace/projects/splash-preview.html");
  const key = await storage.uploadFile({
    fileContent: content,
    fileName: "word-voyage/preview/splash-v3.html",
    contentType: "text/html",
  });
  const url = await storage.generatePresignedUrl({
    key,
    expireTime: 86400,
  });
  console.log("URL:", url);
}

main().catch(console.error);
