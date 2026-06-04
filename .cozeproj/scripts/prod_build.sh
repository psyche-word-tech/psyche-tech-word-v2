#!/bin/bash
if [ -z "${BASH_VERSION:-}" ]; then exec /usr/bin/env bash "$0" "$@"; fi
set -euo pipefail
ROOT_DIR="$(pwd)"

# ==================== 环境变量配置 ====================
# 确保 EXPO_PUBLIC_BACKEND_BASE_URL 在构建时被 Expo 识别
# 优先级：已有环境变量 > COZE_PROJECT_DOMAIN_DEFAULT > localhost
if [ -z "${EXPO_PUBLIC_BACKEND_BASE_URL:-}" ]; then
  if [ -n "${COZE_PROJECT_DOMAIN_DEFAULT:-}" ]; then
    export EXPO_PUBLIC_BACKEND_BASE_URL="$COZE_PROJECT_DOMAIN_DEFAULT"
  fi
fi

echo "[BUILD] EXPO_PUBLIC_BACKEND_BASE_URL: ${EXPO_PUBLIC_BACKEND_BASE_URL:-not set}"

# ==================== 工具函数 ====================
info() {
  echo "[INFO] $1"
}
warn() {
  echo "[WARN] $1"
}
error() {
  echo "[ERROR] $1"
  exit 1
}
check_command() {
  if ! command -v "$1" &> /dev/null; then
    error "命令 $1 未找到，请先安装"
  fi
}

info "==================== 开始构建 ===================="
info "开始执行构建脚本..."
info "正在检查依赖命令是否存在..."
check_command "pnpm"
check_command "npm"

# ==================== 安装 Node 依赖 ====================
info "==================== 安装 Node 依赖 ===================="
if [ -f "$ROOT_DIR/package.json" ]; then
  info "正在执行：pnpm install"
  # 清理可能存在的临时文件，避免 ENOTEMPTY 错误
  rm -rf "$ROOT_DIR/node_modules/.pnpm/expo@54.0.33"*/node_modules/expo_tmp_* 2>/dev/null || true
  (cd "$ROOT_DIR" && pnpm install --registry=https://registry.npmmirror.com --force) || error "Node 依赖安装失败"
fi
info "==================== 依赖安装完成！===================="

info "==================== Expo 构建（设置环境变量）===================="
info "开始构建 Expo 应用..."
# 关键：确保环境变量被传递给 expo build
cd "$ROOT_DIR/client"
EXPO_PUBLIC_BACKEND_BASE_URL="${EXPO_PUBLIC_BACKEND_BASE_URL:-}" npx expo export --platform all || error "Expo 构建失败"
info "==================== Expo 构建完成！===================="

info "==================== dist打包 ===================="
info "开始执行：pnpm run build (server)"
(pushd "$ROOT_DIR/server" > /dev/null && pnpm run build; popd > /dev/null) || error "dist打包失败"
info "==================== dist打包完成！===================="

info "构建完成！"
