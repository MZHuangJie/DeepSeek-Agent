import http from 'http';
import https from 'https';
import { getAuthApiBase } from '../security/authToken';
import { getAuthToken } from '../security/authToken';

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
  apiPath: string,
  body?: unknown,
): Promise<{ status: number; data: T }> {
  const baseUrl = getAuthApiBase();
  const token = getAuthToken();
  if (!token) {
    return Promise.reject(new Error('未登录'));
  }
  const url = joinUrl(baseUrl, apiPath);
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
          Authorization: `Bearer ${token}`,
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
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

export interface CloudSessionMeta {
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
}

export interface CloudSessionPayload {
  id: string;
  title: string;
  updatedAt: number;
  payload: string;
}

export interface CloudListResult {
  success: boolean;
  sessions?: CloudSessionMeta[];
  error?: string;
}

export interface CloudGetResult {
  success: boolean;
  session?: CloudSessionPayload;
  error?: string;
}

export interface CloudPushResult {
  success: boolean;
  session?: CloudSessionMeta;
  error?: string;
}

export async function cloudListSessions(): Promise<CloudListResult> {
  try {
    const { status, data } = await requestJson<{ sessions?: CloudSessionMeta[]; error?: string }>(
      'GET',
      '/sync/sessions',
    );
    if (status === 200 && Array.isArray(data.sessions)) {
      return { success: true, sessions: data.sessions };
    }
    if (status === 401) {
      return { success: false, error: '登录已过期，请重新登录' };
    }
    return { success: false, error: data.error || '获取云端会话失败' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '网络错误';
    return { success: false, error: msg };
  }
}

export async function cloudGetSession(sessionId: string): Promise<CloudGetResult> {
  try {
    const { status, data } = await requestJson<CloudSessionPayload & { error?: string }>(
      'GET',
      `/sync/sessions/${encodeURIComponent(sessionId)}`,
    );
    if (status === 200 && data.payload) {
      return { success: true, session: data };
    }
    if (status === 404) {
      return { success: false, error: '云端会话不存在' };
    }
    if (status === 401) {
      return { success: false, error: '登录已过期，请重新登录' };
    }
    return { success: false, error: data.error || '获取云端会话失败' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '网络错误';
    return { success: false, error: msg };
  }
}

export async function cloudPushSession(sessionId: string, title: string, payload: string): Promise<CloudPushResult> {
  try {
    const { status, data } = await requestJson<CloudSessionMeta & { error?: string }>(
      'PUT',
      `/sync/sessions/${encodeURIComponent(sessionId)}`,
      { title, payload },
    );
    if (status === 200) {
      return { success: true, session: data };
    }
    if (status === 413) {
      return { success: false, error: '会话数据超过 5MB 上限' };
    }
    if (status === 401) {
      return { success: false, error: '登录已过期，请重新登录' };
    }
    return { success: false, error: data.error || '上传会话失败' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '网络错误';
    return { success: false, error: msg };
  }
}

export async function cloudDeleteSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { status, data } = await requestJson<{ success?: boolean; error?: string }>(
      'DELETE',
      `/sync/sessions/${encodeURIComponent(sessionId)}`,
    );
    if (status === 200) {
      return { success: true };
    }
    if (status === 404) {
      return { success: false, error: '云端会话不存在' };
    }
    if (status === 401) {
      return { success: false, error: '登录已过期，请重新登录' };
    }
    return { success: false, error: (data as any).error || '删除会话失败' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '网络错误';
    return { success: false, error: msg };
  }
}

// ---------- Characters ----------

export interface CloudCharacterMeta {
  id: string;
  name: string;
  updatedAt: number;
}

export interface CloudCharacterPayload {
  id: string;
  name: string;
  updatedAt: number;
  payload: string;
}

export interface CloudCharacterListResult {
  success: boolean;
  characters?: CloudCharacterMeta[];
  error?: string;
}

export interface CloudCharacterGetResult {
  success: boolean;
  character?: CloudCharacterPayload;
  error?: string;
}

export interface CloudCharacterPushResult {
  success: boolean;
  character?: CloudCharacterMeta;
  error?: string;
}

export async function cloudListCharacters(): Promise<CloudCharacterListResult> {
  try {
    const { status, data } = await requestJson<{ characters?: CloudCharacterMeta[]; error?: string }>(
      'GET',
      '/sync/characters',
    );
    if (status === 200 && Array.isArray(data.characters)) {
      return { success: true, characters: data.characters };
    }
    if (status === 401) {
      return { success: false, error: '登录已过期，请重新登录' };
    }
    return { success: false, error: data.error || '获取云端角色失败' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '网络错误';
    return { success: false, error: msg };
  }
}

export async function cloudGetCharacter(characterId: string): Promise<CloudCharacterGetResult> {
  try {
    const { status, data } = await requestJson<CloudCharacterPayload & { error?: string }>(
      'GET',
      `/sync/characters/${encodeURIComponent(characterId)}`,
    );
    if (status === 200 && data.payload) {
      return { success: true, character: data };
    }
    if (status === 404) {
      return { success: false, error: '云端角色不存在' };
    }
    if (status === 401) {
      return { success: false, error: '登录已过期，请重新登录' };
    }
    return { success: false, error: data.error || '获取云端角色失败' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '网络错误';
    return { success: false, error: msg };
  }
}

export async function cloudPushCharacter(characterId: string, name: string, payload: string): Promise<CloudCharacterPushResult> {
  try {
    const { status, data } = await requestJson<CloudCharacterMeta & { error?: string }>(
      'PUT',
      `/sync/characters/${encodeURIComponent(characterId)}`,
      { name, payload },
    );
    if (status === 200) {
      return { success: true, character: data };
    }
    if (status === 413) {
      return { success: false, error: '角色数据超过 5MB 上限' };
    }
    if (status === 401) {
      return { success: false, error: '登录已过期，请重新登录' };
    }
    return { success: false, error: data.error || '上传角色失败' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '网络错误';
    return { success: false, error: msg };
  }
}

export async function cloudDeleteCharacter(characterId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { status, data } = await requestJson<{ success?: boolean; error?: string }>(
      'DELETE',
      `/sync/characters/${encodeURIComponent(characterId)}`,
    );
    if (status === 200) {
      return { success: true };
    }
    if (status === 404) {
      return { success: false, error: '云端角色不存在' };
    }
    if (status === 401) {
      return { success: false, error: '登录已过期，请重新登录' };
    }
    return { success: false, error: (data as any).error || '删除角色失败' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '网络错误';
    return { success: false, error: msg };
  }
}
