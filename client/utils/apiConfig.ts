import Constants from 'expo-constants';

// 线上生产环境地址（兜底）
const PROD_API_URL = 'https://word-voyage-api-production.up.railway.app';

function isValidApiUrl(url: string | undefined): url is string {
  return !!url && !url.includes('localhost') && !url.includes('railway.app');
}

// 根据环境自动选择 API 地址
function getApiBaseUrl(): string {
  // 1. 环境变量（构建时注入）- 优先使用
  const envUrl = process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
  if (envUrl) return envUrl;

  // 2. Web 环境：使用 Vercel 环境变量或 Railway
  if (typeof window !== 'undefined') {
    const vercelUrl = process.env.VERCEL_URL;
    if (vercelUrl) return `https://${vercelUrl}`;
    return PROD_API_URL; // 回退到 Railway
  }

  // 3. Native 环境：优先从 manifest 读取，否则兜底 Railway
  const manifestUrl = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;
  if (manifestUrl) return manifestUrl;

  return PROD_API_URL;
}

const API_BASE_URL = getApiBaseUrl();

console.log('[API_BASE_URL]', API_BASE_URL);

export const fetchApiConfig = async (): Promise<string> => {
  return API_BASE_URL;
};

export const getApiUrl = (): string => {
  return API_BASE_URL;
};

export { API_BASE_URL };
export default API_BASE_URL;
