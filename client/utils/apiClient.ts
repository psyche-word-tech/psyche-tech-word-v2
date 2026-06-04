import { API_BASE_URL } from './apiConfig';

/**
 * 带超时和自动重试的 fetch 包装
 * - 超时: 30 秒（Railway 冷启动可能较慢）
 * - 重试: 失败/502/504 时自动重试 2 次
 */
export async function fetchWithRetry(
  path: string,
  options?: RequestInit,
  maxRetries = 2,
  baseUrl?: string
): Promise<Response> {
  const apiBase = baseUrl || API_BASE_URL;
  const url = path.startsWith('http') ? path : `${apiBase}${path}`;
  const timeout = 30000; // 30 秒超时，给 Railway 冷启动留足时间

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timer);

      // 502/504 可能是 Railway 休眠中，需要重试
      if ((response.status === 502 || response.status === 504) && attempt < maxRetries) {
        console.log(`[fetchRetry] ${response.status} on attempt ${attempt + 1}, retrying...`);
        await sleep(2000 + attempt * 1000); // 递增延迟
        continue;
      }

      return response;
    } catch (err: any) {
      const isTimeout = err.name === 'AbortError';
      const isNetworkError = err.message?.includes('Network request failed');

      if ((isTimeout || isNetworkError) && attempt < maxRetries) {
        console.log(`[fetchRetry] ${isTimeout ? 'Timeout' : 'NetworkError'} on attempt ${attempt + 1}, retrying...`);
        await sleep(2000 + attempt * 1000);
        continue;
      }

      throw err;
    }
  }

  throw new Error(`Request failed after ${maxRetries + 1} attempts`);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
