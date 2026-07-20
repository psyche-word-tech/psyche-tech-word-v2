/**
 * API配置 - 统一管理API基础URL
 *
 * 部署到 Render 后，将下面的 URL 替换为你的 Render 服务地址：
 * 格式：https://<your-service-name>.onrender.com
 * 示例：https://word-voyage-api.onrender.com
 */
const PROD_API_URL = 'http://82.157.60.179:5000';

/**
 * Render 免费部署指南：
 * 1. 访问 https://dashboard.render.com 注册/登录
 * 2. 点击 "New +" → "Web Service"
 * 3. 连接你的 GitHub 仓库
 * 4. Render 会自动读取根目录的 render.yaml 配置
 * 5. 在 Environment 标签页填入 .env 中的所有环境变量
 * 6. 点击部署，等待完成
 * 7. 复制生成的域名（如 https://word-voyage-api.onrender.com）
 * 8. 替换上面的 PROD_API_URL，重新构建部署前端
 */

export const getApiBaseUrl = (): string => {
  // Web环境下根据当前域名动态选择
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // 只有真正的本地开发才直连 localhost:9091
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:9091';
    }
    // 其他所有浏览器环境（沙箱预览、生产部署、Vercel）都用相对路径
    // 沙箱预览：代理服务器会转发 /api/* 到后端
    // 生产部署：Express 同端口处理 API
    return '';
  }

  // Node.js / SSR 环境
  return 'http://localhost:9091';
};

// 使用 getter 确保运行时动态计算，避免构建时内联
export const apiConfig = {
  get API_BASE_URL() {
    return getApiBaseUrl();
  }
};

// 兼容旧代码的导出方式
export const API_BASE_URL = getApiBaseUrl();
console.log('[API_BASE_URL initial]', API_BASE_URL);

/**
 * 获取请求头配置
 * @returns Headers配置对象
 */
export const getHeaders = () => ({
  'Content-Type': 'application/json',
});

/**
 * 通用的GET请求方法
 * @param endpoint API端点
 * @returns Promise
 */
export const get = async (endpoint: string) => {
  const url = `${getApiBaseUrl()}${endpoint}`;
  console.log(`[API GET] ${url}`);
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

/**
 * 通用的POST请求方法
 * @param endpoint API端点
 * @param data 请求体数据
 * @returns Promise
 */
export const post = async (endpoint: string, data: any) => {
  const url = `${getApiBaseUrl()}${endpoint}`;
  console.log(`[API POST] ${url}`, data);
  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};
