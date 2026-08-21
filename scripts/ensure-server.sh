#!/bin/bash

# 检查服务是否在运行
if ! pgrep -f "node dist/index.js" > /dev/null; then
  echo "[$(date)] Server not running, starting..." >> /tmp/server-autostart.log
  cd /workspace/projects/server
  nohup node dist/index.js > /tmp/server-dev.log 2>&1 &
  echo "[$(date)] Server started with PID $!" >> /tmp/server-autostart.log
fi
