/**
 * API配置 - 统一管理API基础URL
 */
const PROD_API_URL = 'https://word-voyage-api-production.up.railway.app';

export const getApiBaseUrl = (): string => {
  // Web环境下根据当前域名动态选择
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // 本地开发环境 (localhost / 127.0.0.1 / 本机IP)
    if (hostname === 'localhost' || hostname === '127.0.0.1' || /^192\.168\./.test(hostname) || /^10\./.test(hostname) || /^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname)) {
      return 'http://localhost:9091';
    }
    // Coze 沙箱预览环境 - 使用相对路径，由预览服务器代理到后端
    if (hostname.includes('coze') || hostname.includes('sandbox') || window.location.port === '5000') {
      return '';
    }
    // Vercel环境
    if (hostname.includes('vercel.app')) {
      const vercelUrl = process.env.VERCEL_URL;
      if (vercelUrl) return `https://${vercelUrl}`;
    }
  }

  // 生产部署使用生产API
  return PROD_API_URL;
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
