# Koyeb 部署用 Dockerfile
# 构建并运行 Express.js 后端服务

FROM node:20-slim

# 安装 pnpm
RUN npm install -g pnpm

WORKDIR /app

# 复制根目录 lockfile 和 workspace 配置
COPY pnpm-lock.yaml pnpm-workspace.yaml ./

# 复制 client 和 server 的 package.json
COPY client/package.json ./client/
COPY server/package.json ./server/

# 安装所有依赖
RUN pnpm install --registry=https://registry.npmjs.org --no-frozen-lockfile

# 构建前端
WORKDIR /app/client
COPY client/ .
RUN npx expo export --platform web

# 复制后端源码
WORKDIR /app/server
COPY server/ .

# 复制前端静态文件到 public 目录
RUN rm -rf public && cp -r ../client/dist public

# 构建后端（使用 build.js 编译 dist/index.js）
RUN node build.js

# 暴露端口（Koyeb 会通过 PORT 环境变量传入）
EXPOSE 8080

# 启动服务
CMD ["node", "dist/index.js"]
