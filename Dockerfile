# Koyeb 部署用 Dockerfile
# 构建并运行 Express.js 后端服务

FROM node:20-slim

# 安装 pnpm
RUN npm install -g pnpm

WORKDIR /app

# 复制根目录 lockfile 和 server package.json
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/

WORKDIR /app/server

# 安装依赖（使用官方 registry，不用 frozen-lockfile）
RUN pnpm install --registry=https://registry.npmjs.org --no-frozen-lockfile

# 复制后端源码
COPY server/ .

# 构建（使用 build.js 编译 dist/index.js）
RUN node build.js

# 暴露端口（Koyeb 会通过 PORT 环境变量传入）
EXPOSE 8080

# 启动服务
CMD ["node", "dist/index.js"]
