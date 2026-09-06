#!/usr/bin/env bash
set -euo pipefail

# 基于脚本位置定位项目根目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# 显式声明关键环境变量
export PORT=5000

# ==================== 构建前端 ====================
echo "[1/4] 构建前端..."
cd client
npx expo export --platform web

# 复制 KaTeX 字体文件
echo "  复制 KaTeX 字体..."
mkdir -p dist/_expo/static/css/fonts
cp /workspace/projects/node_modules/.pnpm/katex@0.18.4/node_modules/katex/dist/fonts/* dist/_expo/static/css/fonts/ 2>/dev/null || true
cd "$PROJECT_DIR"

# ==================== 复制前端到 server/public ====================
echo "[2/4] 复制前端文件到 server/public..."
rm -rf server/public
cp -r client/dist server/public
# 模型文件直接从 server/models/ 提供，不受 public 重建影响

# ==================== 启动后端服务 ====================
echo "[3/4] 启动后端服务 (端口 5000)..."

# 清理 5000 端口残留进程
pkill -9 -f "node dist/index.js" 2>/dev/null || true
sleep 2

cd server
# 使用 nohup 确保服务在后台持续运行
nohup env NODE_ENV=development PORT=5000 node dist/index.js > /tmp/server-dev.log 2>&1 &
BACKEND_PID=$!
echo "后端服务已启动 (PID: $BACKEND_PID)"

# 等待后端启动
for i in {1..15}; do
    if ss -tlnp | grep -q ":5000"; then
        echo "后端服务启动成功"
        break
    fi
    sleep 1
done

# 验证服务是否可访问
if curl -s http://localhost:5000/api/v1/health > /dev/null 2>&1; then
    echo "后端服务验证成功"
else
    echo "警告：后端服务可能未完全启动，请查看日志：tail -f /tmp/server-dev.log"
fi

echo ""
echo "=== 服务已就绪 ==="
echo "访问: http://localhost:5000/"
echo "API:  http://localhost:5000/api/v1/"
echo ""
echo "查看日志: tail -f /tmp/server-dev.log"
