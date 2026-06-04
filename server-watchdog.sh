#!/bin/bash
# 后端服务自动守护脚本
# 每 10 秒检查一次，如果后端挂了自动重启

SERVER_DIR="/workspace/projects/server"
LOG_FILE="/tmp/server.log"
PORT=9091

echo "[$(date)] Server watchdog started"

while true; do
  if ! pgrep -f "node dist/index.js" > /dev/null 2>&1; then
    echo "[$(date)] Server not running, restarting..."
    cd "$SERVER_DIR" && PORT=$PORT NODE_ENV=production nohup node dist/index.js >> "$LOG_FILE" 2>&1 &
    sleep 2
    if pgrep -f "node dist/index.js" > /dev/null 2>&1; then
      echo "[$(date)] Server restarted successfully"
    else
      echo "[$(date)] Server restart failed"
    fi
  fi
  sleep 10
done
