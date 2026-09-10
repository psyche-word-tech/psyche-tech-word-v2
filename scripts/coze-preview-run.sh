#!/usr/bin/env bash
set -euo pipefail

# 基于脚本位置定位项目根目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# 显式声明关键环境变量
export PORT=5000

# ==================== 构建前端 ====================
build_frontend() {
    echo "[1/3] 构建前端..."
    cd client
    npx expo export --platform web
    
    # 复制 KaTeX 字体文件
    echo "  复制 KaTeX 字体..."
    mkdir -p dist/_expo/static/css/fonts
    cp /workspace/projects/node_modules/.pnpm/katex@0.18.4/node_modules/katex/dist/fonts/* dist/_expo/static/css/fonts/ 2>/dev/null || true
    cd "$PROJECT_DIR"
    
    # 复制前端到 server/public
    echo "[2/3] 复制前端文件到 server/public..."
    rm -rf server/public
    cp -r client/dist server/public
}

# ==================== 构建后端 ====================
build_backend() {
    echo "构建后端..."
    cd server
    pnpm run build
    cd "$PROJECT_DIR"
}

# ==================== 启动服务（使用 nodemon 监听 dist 目录自动重启） ====================
start_service_with_nodemon() {
    echo "[3/3] 启动后端服务 (端口 5000，使用 nodemon 自动重启)..."
    
    # 清理 5000 端口残留进程
    pkill -9 -f "node dist/index.js" 2>/dev/null || true
    pkill -9 -f "nodemon" 2>/dev/null || true
    sleep 2
    
    cd server
    # 使用 nodemon 监听 dist 目录变化，自动重启服务
    nohup npx nodemon --watch dist --ext js --exec "node dist/index.js" > /tmp/server-dev.log 2>&1 &
    BACKEND_PID=$!
    echo "后端服务已启动 (PID: $BACKEND_PID，使用 nodemon 自动重启)"
    cd "$PROJECT_DIR"
    
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
}

# ==================== 检查服务是否已在运行 ====================
if ss -tlnp | grep -q ":5000"; then
    echo "✓ 服务已在运行 (端口 5000)"
    echo ""
    echo "=== 重新构建前端和后端 ==="
    
    # 构建前端
    build_frontend
    
    # 构建后端（nodemon 会自动检测 dist 变化并重启）
    build_backend
    
    echo ""
    echo "=== 已更新（nodemon 将自动重启服务） ==="
    echo "访问: http://localhost:5000/"
    echo "API:  http://localhost:5000/api/v1/"
    echo ""
    echo "查看日志: tail -f /tmp/server-dev.log"
    exit 0
fi

# ==================== 服务未运行，完整启动 ====================
echo "=== 完整启动服务 ==="
echo ""

# 产物已存在时跳过构建，直接启动，加快预览就绪速度
if [ -f "server/public/index.html" ] && [ -f "server/dist/index.js" ]; then
    echo "产物已存在，跳过构建直接启动服务"
    start_service_with_nodemon
    exit 0
fi

# 构建前端
build_frontend

# 构建后端
build_backend

# 启动服务（使用 nodemon）
start_service_with_nodemon

echo ""
echo "=== 服务已就绪 ==="
echo "访问: http://localhost:5000/"
echo "API:  http://localhost:5000/api/v1/"
echo ""
echo "查看日志: tail -f /tmp/server-dev.log"
echo "注意：后端使用 nodemon 监听 dist 目录，代码变化时会自动重启"
