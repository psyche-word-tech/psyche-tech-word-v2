#!/bin/bash
set -e

echo "=== 1. 构建前端 ==="
cd /workspace/projects/client
npx expo export --platform web

echo "=== 2. 复制到 server/public ==="
cd /workspace/projects
rm -rf server/public
rm -rf client/web-static
cp -r client/dist server/public
cp -r client/dist client/web-static

echo "=== 3. 构建后端 ==="
cd /workspace/projects/server
pnpm run build

echo "=== 4. 打包 ==="
cd /workspace/projects
tar czf server-full.tar.gz server/

echo "=== 5. 部署到腾讯云 ==="
scp -o StrictHostKeyChecking=no server-full.tar.gz ubuntu@82.157.60.179:/tmp/
ssh -o StrictHostKeyChecking=no ubuntu@82.157.60.179 'cd /opt && sudo rm -rf word-voyage && sudo mkdir -p word-voyage && sudo tar xzf /tmp/server-full.tar.gz -C word-voyage && cd word-voyage/server && sudo cp /tmp/.env.backup .env && sudo pnpm install && sudo pnpm run build && sudo pm2 restart word-voyage-api --update-env && sudo pm2 save'

echo "=== 部署完成！==="
echo "访问: http://82.157.60.179:5000/"
