#!/bin/bash
# 后台启动所有服务（不占用终端）

echo "==================== 启动服务 ===================="

# 启动后端服务 (端口 9091)
if ! ss -tlnp | grep -q ":9091"; then
    echo "[1/2] 启动后端服务..."
    cd /workspace/projects/server && pnpm run dev > /tmp/backend.log 2>&1 &
    echo "后端 PID: $!"
    
    # 等待后端启动
    for i in {1..10}; do
        if ss -tlnp | grep -q ":9091"; then
            echo "后端服务启动成功"
            break
        fi
        sleep 1
    done
else
    echo "[1/2] 后端服务已在运行"
fi

# 启动前端服务 (端口 5000)
if ! ss -tlnp | grep -q ":5000"; then
    echo "[2/2] 启动前端服务..."
    cd /workspace/projects && python3 -m http.server 5000 --directory client/web-static > /tmp/frontend.log 2>&1 &
    echo "前端 PID: $!"
else
    echo "[2/2] 前端服务已在运行"
fi

echo "==================== 启动完成 ===================="
echo "前端: http://localhost:5000"
echo "后端: http://localhost:9091"
echo ""
echo "日志文件: /tmp/backend.log, /tmp/frontend.log"
