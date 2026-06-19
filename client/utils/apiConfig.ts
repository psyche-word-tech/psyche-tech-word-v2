// 沙箱预览环境强制使用本地后端
const API_BASE_URL = 'http://localhost:9091';

console.log('[API_BASE_URL]', API_BASE_URL);

export const fetchApiConfig = async (): Promise<string> => {
  return API_BASE_URL;
};

export const getApiUrl = (): string => {
  return API_BASE_URL;
};

export { API_BASE_URL };
