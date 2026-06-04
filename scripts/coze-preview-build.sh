#!/usr/bin/env bash
set -euo pipefail

# 基于脚本位置定位项目根目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# 安装 client 依赖（如果需要）
if [ ! -d "client/node_modules" ]; then
  echo "安装 client 依赖..."
  cd client && pnpm install --registry=https://registry.npmmirror.com || pnpm install
  cd ..
fi

echo "预览构建完成"
