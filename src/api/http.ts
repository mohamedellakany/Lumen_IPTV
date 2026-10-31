import { Platform } from 'react-native';

import { useSettings } from '@/store/settings';

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Browsers block cross-origin requests to most IPTV servers (no CORS headers), so on web
 * requests and streams go through the local dev proxy (server/proxy.mjs). Native apps call the server directly.
 */
export function proxify(url: string): string {
  if (Platform.OS !== 'web') return url;
  const proxy = useSettings.getState().webProxyUrl.trim().replace(/\/+$/, '');
  if (!proxy) return url;
  return `${proxy}/proxy?url=${encodeURIComponent(url)}`;
}

export async function fetchText(url: string, timeoutMs = 45_000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(proxify(url), { signal: controller.signal });
    if (res.status === 401 || res.status === 403) {
      throw new ApiError('Access denied. Check your username and password, or whether your subscription is active.', res.status);
    }
    if (!res.ok) throw new ApiError(`Server responded with ${res.status}`, res.status);
    return await res.text();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) throw new ApiError('The server took too long to respond.');
    if (Platform.OS === 'web') {
      throw new ApiError(
        'Could not reach the server. In the browser, make sure the dev proxy is running (npm run proxy) and the proxy URL in Settings is correct.',
      );
    }
    throw new ApiError('Could not reach the server. Check the URL and your internet connection.');
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T>(url: string, timeoutMs?: number): Promise<T> {
  const text = await fetchText(url, timeoutMs);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError('The server returned an unexpected response. Check the server URL.');
  }
}
