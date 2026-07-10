#!/bin/bash
# 一键部署脚本 - 腾讯云轻量服务器
# 使用方法：SSH 登录服务器后执行：bash deploy-server.sh

set -e

echo "=== 单词之旅后端一键部署脚本 ==="
echo ""

# 配置
REPO_URL="https://github.com/psyche-tech/psyche-tech-word-v2.git"
APP_DIR="/opt/word-voyage"
NODE_VERSION="20"
PORT="5000"

echo "[1/8] 更新系统..."
apt-get update -y

echo "[2/8] 安装 Node.js ${NODE_VERSION}..."
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" != "$NODE_VERSION" ]; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y nodejs
fi
node -v
npm -v

echo "[3/8] 安装 pnpm..."
if ! command -v pnpm &> /dev/null; then
    npm install -g pnpm
fi
pnpm -v

echo "[4/8] 安装 PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi
pm2 -v

echo "[5/8] 拉取代码..."
if [ -d "$APP_DIR" ]; then
    cd "$APP_DIR"
    git pull origin main
else
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

echo "[6/8] 安装依赖并构建..."
cd "$APP_DIR/server"
pnpm install
pnpm run build

echo "[7/8] 配置环境变量..."
if [ ! -f "$APP_DIR/server/.env" ]; then
    echo "创建 .env 文件..."
    cat > "$APP_DIR/server/.env" << 'EOF'
NODE_ENV=production
PORT=5000
SUPABASE_URL=https://oimqcpjryhridoxczbei.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pbXFjcGpyeWhyaWRveGN6YmVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM3NzM0NTAsImV4cCI6MjA5MzQ5NDUwfQ.CmZtFZH0gG0ADgYyM5LYjSTkYdX0F_S9Q1tTr1sA12A
EOF
fi

echo "[8/8] 启动服务..."
cd "$APP_DIR/server"
pm install -g tsx
pm2 delete word-voyage-api 2>/dev/null || true
pm2 start dist/index.js --name word-voyage-api --env production
pm2 save
pm2 startup systemd

echo ""
echo "=== 部署完成 ==="
echo "API 地址: http://$(curl -s ifconfig.me):${PORT}"
echo ""
echo "常用命令："
echo "  查看日志: pm2 logs word-voyage-api"
echo "  重启服务: pm2 restart word-voyage-api"
echo "  停止服务: pm2 stop word-voyage-api"
echo ""
echo "⚠️  请确保腾讯云控制台防火墙已开放 ${PORT} 端口！"
