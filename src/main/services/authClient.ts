import { net } from 'electron';
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

function joinUrl(base: string, path: string): string {
  const normalized = normalizeBaseUrl(base);
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${normalized}${suffix}`;
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

  return new Promise((resolve, reject) => {
    const req = net.request({
      url,
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    req.on('response', (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (c: Buffer) => chunks.push(c));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let data: T = {} as T;
        if (text) {
          try {
            data = JSON.parse(text) as T;
          } catch {
            reject(new Error(`无效 JSON 响应 (${response.statusCode})`));
            return;
          }
        }
        resolve({ status: response.statusCode || 0, data });
      });
      response.on('error', (err: Error) => {
        console.error('[authClient] response error:', err);
        reject(err);
      });
    });

    req.on('error', (err: Error) => {
      console.error('[authClient] request error:', err);
      reject(err);
    });

    if (payload) {
      req.write(payload, 'utf-8');
    }
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
    console.error('[authClient] login error:', msg);
    if (/TLS|ECONNREFUSED|ENOTFOUND|socket disconnected/i.test(msg)) {
      return { success: false, error: `无法连接认证服务器（${getAuthApiBase()}）。错误：${msg}` };
    }
    return { success: false, error: msg };
  }
}

export async function authRegister(username: string, password: string, email?: string): Promise<AuthResult> {
  try {
    const body: Record<string, string> = { username, password };
    if (email) body.email = email;
    const { status, data } = await requestJson<{ token?: string; user?: AuthUser; error?: string }>(
      'POST',
      '/auth/register',
      body,
    );
    if (status === 200 && data.token && data.user) {
      saveAuthToken(data.token);
      return { success: true, user: data.user };
    }
    return { success: false, error: parseError(data, status === 409 ? '用户名已存在' : '注册失败') };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '网络错误';
    console.error('[authClient] register error:', msg);
    if (/TLS|ECONNREFUSED|ENOTFOUND|socket disconnected/i.test(msg)) {
      return { success: false, error: `无法连接认证服务器（${getAuthApiBase()}）。错误：${msg}` };
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : '网络错误';
    console.error('[authClient] restore error:', msg);
    return { success: false, error: `无法连接服务器：${msg}` };
  }
}

export async function authUpdateProfile(updates: { username?: string; email?: string; avatar?: string }): Promise<AuthResult> {
  const token = getAuthToken();
  if (!token) return { success: false, error: '未登录' };
  try {
    const body: Record<string, string> = {};
    if (updates.username !== undefined) body.username = updates.username;
    if (updates.email !== undefined) body.email = updates.email;
    if (updates.avatar !== undefined) body.avatar = updates.avatar;
    const { status, data } = await requestJson<{ token?: string; user?: AuthUser; error?: string }>(
      'POST',
      '/auth/update-profile',
      body,
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[authClient] health check error:', msg);
    return false;
  }
}
