#!/bin/bash
LOG="/tmp/server-robust.log"
echo "[$(date)] Robust server manager started" >> "$LOG"

while true; do
  if ! curl -s http://localhost:9091/api/v1/wordbooks > /dev/null 2>&1; then
    echo "[$(date)] Server down, restarting..." >> "$LOG"
    pkill -f "node dist/index.js" 2>/dev/null
    sleep 1
    cd /workspace/projects/server
    PORT=9091 NODE_ENV=production node dist/index.js >> /tmp/server.log 2>&1 &
    echo "[$(date)] Server restarted, PID: $!" >> "$LOG"
  fi
  sleep 5
done
