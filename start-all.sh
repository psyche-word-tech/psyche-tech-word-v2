#!/bin/bash
# 一键启动前端 + 后端服务

echo "==================== 启动服务 ===================="

# 启动后端服务 (端口 9091)
echo "[1/2] 启动后端服务..."
cd /workspace/projects/server && pnpm run dev > /dev/null 2>&1 &
BACKEND_PID=$!
echo "后端服务 PID: $BACKEND_PID"

# 等待后端启动
sleep 3

# 检查后端是否启动成功
if ss -tlnp | grep -q ":9091"; then
    echo "后端服务启动成功 (端口 9091)"
else
    echo "后端服务启动失败"
fi

# 检查前端服务是否已运行
if ss -tlnp | grep -q ":5000"; then
    echo "前端服务已在运行 (端口 5000)"
else
    echo "[2/2] 启动前端服务..."
    cd /workspace/projects && python3 -m http.server 5000 --directory client/web-static > /dev/null 2>&1 &
    echo "前端服务启动成功 (端口 5000)"
fi

echo "==================== 启动完成 ===================="
echo "前端: http://localhost:5000"
echo "后端: http://localhost:9091"
