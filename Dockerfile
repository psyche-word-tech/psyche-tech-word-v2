# Railway 部署用 Dockerfile
# 构建并运行 Express.js 后端服务

FROM node:20-slim

# 安装 pnpm
RUN npm install -g pnpm

WORKDIR /app

# 复制所有源码
COPY . .

# 安装所有依赖
RUN pnpm install --registry=https://registry.npmjs.org --no-frozen-lockfile --ignore-scripts=false

# 构建前端
WORKDIR /app/client
RUN npx expo export --platform web

# 复制前端静态文件到 server/public 目录
RUN rm -rf ../server/public && cp -r dist ../server/public

# 构建后端
WORKDIR /app/server
RUN node build.js

# 暴露端口（Railway 会通过 PORT 环境变量传入）
EXPOSE 8080

# 启动服务
CMD ["node", "dist/index.js"]
