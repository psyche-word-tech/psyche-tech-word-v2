#!/usr/bin/env bash
set -uo pipefail

# 后端进程守护脚本
# 用法: bash scripts/backend-monitor.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SERVER_DIR="$PROJECT_DIR/server"
LOG_FILE="$SERVER_DIR/backend.log"
PID_FILE="$SERVER_DIR/backend.pid"
HEALTH_URL="http://localhost:9091/api/v1/health"
MAX_RETRIES=3
RETRY_INTERVAL=5

# 启动后端
start_backend() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backend..."
  cd "$SERVER_DIR"
  nohup pnpm tsx ./src/index.ts >> "$LOG_FILE" 2>&1 &
  local pid=$!
  echo $pid > "$PID_FILE"
  sleep 2

  # 等待健康检查通过
  local retries=0
  while [ $retries -lt $MAX_RETRIES ]; do
    if curl -s "$HEALTH_URL" > /dev/null 2>&1; then
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backend started successfully (PID: $pid)"
      return 0
    fi
    retries=$((retries + 1))
    sleep $RETRY_INTERVAL
  done

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backend failed to start"
  return 1
}

# 停止后端
stop_backend() {
  if [ -f "$PID_FILE" ]; then
    local pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] Stopping backend (PID: $pid)..."
      kill "$pid" 2>/dev/null
      sleep 1
    fi
    rm -f "$PID_FILE"
  fi
  # 清理残留进程
  pkill -f "tsx ./src/index.ts" 2>/dev/null || true
}

# 检查后端健康
is_healthy() {
  curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null | grep -q "200"
}

# 守护循环
monitor() {
  while true; do
    if ! is_healthy; then
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backend unhealthy, restarting..."
      stop_backend
      start_backend
    fi
    sleep 10
  done
}

# 主逻辑
case "${1:-monitor}" in
  start)
    stop_backend
    start_backend
    ;;
  stop)
    stop_backend
    ;;
  monitor)
    stop_backend
    start_backend
    monitor
    ;;
  *)
    echo "Usage: $0 {start|stop|monitor}"
    exit 1
    ;;
esac
