import { S3Storage } from 'coze-coding-dev-sdk';
import * as fs from 'fs';

const storage = new S3Storage({
  endpointUrl: 'https://tos.coze.site',
  accessKey: '',
  secretKey: '',
  bucketName: 'coze-coding-project',
  region: 'cn-beijing',
});

async function upload() {
  const content = fs.readFileSync('/workspace/projects/splash-vertices.html');
  const key = await storage.uploadFile({
    fileContent: content,
    fileName: 'word-voyage/preview/splash-vertices.html',
    contentType: 'text/html',
  });
  const url = await storage.generatePresignedUrl({ key, expireTime: 86400 });
  console.log('Vertices Preview:', url);
}

upload().catch(console.error);
