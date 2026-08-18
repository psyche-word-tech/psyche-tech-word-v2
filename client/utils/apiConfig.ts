// API 基础 URL 配置
// 后端服务监听 5000 端口，同时提供前端页面和 API
// 所有环境都使用相对路径

function getApiBaseUrl() {
  // 所有环境都使用相对路径，由后端统一处理
  return '';
}

export const API_BASE_URL = getApiBaseUrl();
