#!/usr/bin/env bash
# 后端服务运行脚本
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVER_DIR="$PROJECT_DIR/server"

cd "$SERVER_DIR"

# Railway 使用 PORT 环境变量，默认为 5000
export PORT="${PORT:-5000}"

echo "[RUN] Starting server on port $PORT..."
pnpm run start
