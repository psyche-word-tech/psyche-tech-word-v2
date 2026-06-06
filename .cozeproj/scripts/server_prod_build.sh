#!/usr/bin/env bash
# 后端服务构建脚本
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVER_DIR="$PROJECT_DIR/server"

cd "$SERVER_DIR"

echo "[BUILD] Installing dependencies..."
pnpm install --frozen-lockfile

echo "[BUILD] Building TypeScript..."
pnpm run build

echo "[BUILD] Build complete!"
