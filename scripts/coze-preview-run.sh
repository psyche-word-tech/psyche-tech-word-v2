#!/usr/bin/env bash
set -euo pipefail

# 基于脚本位置定位项目根目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# 显式声明关键环境变量
export PORT=5000

# ==================== 启动后端服务 ====================
echo "[1/2] 启动后端服务 (端口 9091)..."

# 检查后端是否已运行
if ! ss -tlnp | grep -q ":9091"; then
    cd server && pnpm run dev > /dev/null 2>&1 &
    BACKEND_PID=$!
    echo "后端服务已启动 (PID: $BACKEND_PID)"
    
    # 等待后端启动
    for i in {1..10}; do
        if ss -tlnp | grep -q ":9091"; then
            echo "后端服务启动成功"
            break
        fi
        sleep 1
    done
else
    echo "后端服务已在运行"
fi

# ==================== 启动前端服务 ====================
echo "[2/2] 启动前端预览服务 (端口 5000)..."

# 清理 5000 端口残留进程（幂等性）
fuser -k 5000/tcp 2>/dev/null || true
sleep 1

# 使用预导出的静态文件启动预览
echo "启动前端预览服务，端口 5000..."
exec python3 ".cozeproj/scripts/serve-static.py" 5000 "client/web-static"
