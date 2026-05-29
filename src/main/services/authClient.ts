import http from 'http';
import https from 'https';
import {
  clearAuthToken,
  getAuthApiBase,
  getAuthToken,
  saveAuthToken,
  setAuthApiBase,
} from '../security/authToken';

export interface AuthUser {
  id: number;
  username: string;
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

interface ApiErrorBody {
  error?: string;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

function joinUrl(base: string, path: string): URL {
  const normalized = normalizeBaseUrl(base);
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return new URL(`${normalized}${suffix}`);
}

function requestJson<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string | null,
  baseUrl?: string,
): Promise<{ status: number; data: T }> {
  const url = joinUrl(baseUrl || getAuthApiBase(), path);
  const payload = body !== undefined ? JSON.stringify(body) : undefined;
  const isHttps = url.protocol === 'https:';
  const lib = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let data: T = {} as T;
          if (text) {
            try {
              data = JSON.parse(text) as T;
            } catch {
              reject(new Error(`无效 JSON 响应 (${res.statusCode})`));
              return;
            }
          }
          resolve({ status: res.statusCode || 0, data });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function parseError(data: ApiErrorBody, fallback: string): string {
  return typeof data?.error === 'string' && data.error.trim() ? data.error : fallback;
}

export async function authLogin(username: string, password: string): Promise<AuthResult> {
  try {
    const { status, data } = await requestJson<{ token?: string; user?: AuthUser; error?: string }>(
      'POST',
      '/auth/login',
      { username, password },
    );
    if (status === 200 && data.token && data.user) {
      saveAuthToken(data.token);
      return { success: true, user: data.user };
    }
    return { success: false, error: parseError(data, status === 401 ? '用户名或密码错误' : '登录失败') };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '网络错误';
    if (/TLS|ECONNREFUSED|ENOTFOUND|socket disconnected/i.test(msg)) {
      return { success: false, error: `无法连接认证服务器（${getAuthApiBase()}）。本地调试请先运行 npm run start:server，并在面板填写 http://127.0.0.1:8787/ds/api` };
    }
    return { success: false, error: msg };
  }
}

export async function authRegister(username: string, password: string): Promise<AuthResult> {
  try {
    const { status, data } = await requestJson<{ token?: string; user?: AuthUser; error?: string }>(
      'POST',
      '/auth/register',
      { username, password },
    );
    if (status === 200 && data.token && data.user) {
      saveAuthToken(data.token);
      return { success: true, user: data.user };
    }
    return { success: false, error: parseError(data, status === 409 ? '用户名已存在' : '注册失败') };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '网络错误';
    if (/TLS|ECONNREFUSED|ENOTFOUND|socket disconnected/i.test(msg)) {
      return { success: false, error: `无法连接认证服务器（${getAuthApiBase()}）。本地调试请先运行 npm run start:server，并在面板填写 http://127.0.0.1:8787/ds/api` };
    }
    return { success: false, error: msg };
  }
}

export async function authRestore(): Promise<AuthResult> {
  const token = getAuthToken();
  if (!token) return { success: false };
  try {
    const { status, data } = await requestJson<{ user?: AuthUser; error?: string }>(
      'GET',
      '/auth/me',
      undefined,
      token,
    );
    if (status === 200 && data.user) {
      return { success: true, user: data.user };
    }
    clearAuthToken();
    return { success: false, error: status === 401 ? undefined : parseError(data, '会话已失效') };
  } catch {
    return { success: false, error: '无法连接服务器' };
  }
}

export async function authUpdateProfile(username: string): Promise<AuthResult> {
  const token = getAuthToken();
  if (!token) return { success: false, error: '未登录' };
  try {
    const { status, data } = await requestJson<{ token?: string; user?: AuthUser; error?: string }>(
      'POST',
      '/auth/update-profile',
      { username },
      token,
    );
    if (status === 200 && data.token && data.user) {
      saveAuthToken(data.token);
      return { success: true, user: data.user };
    }
    return { success: false, error: parseError(data, '更新失败') };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '网络错误';
    if (/TLS|ECONNREFUSED|ENOTFOUND|socket disconnected/i.test(msg)) {
      return { success: false, error: `无法连接认证服务器（${getAuthApiBase()}）` };
    }
    return { success: false, error: msg };
  }
}

export async function authLogout(): Promise<void> {
  const token = getAuthToken();
  if (token) {
    try {
      await requestJson('POST', '/auth/logout', {}, token);
    } catch {
      // ignore network errors on logout
    }
  }
  clearAuthToken();
}

export function getStoredApiBase(): string {
  return getAuthApiBase();
}

export function updateApiBase(baseUrl: string): void {
  setAuthApiBase(baseUrl);
}

export async function authHealthCheck(baseUrl?: string): Promise<boolean> {
  try {
    const { status, data } = await requestJson<{ ok?: boolean }>('GET', '/health', undefined, null, baseUrl);
    return status === 200 && data.ok === true;
  } catch {
    return false;
  }
}
