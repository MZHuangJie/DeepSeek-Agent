import { net } from 'electron';
import { getAuthApiBase } from '../security/authToken';
import { getAuthToken } from '../security/authToken';

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

  console.log(`[syncClient] ${method} ${url}`);

  return new Promise((resolve, reject) => {
    const req = net.request({
      url,
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    req.on('response', (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (c: Buffer) => chunks.push(c));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        console.log(`[syncClient] ${method} ${apiPath} -> ${response.statusCode}, body=${text.slice(0, 200)}`);
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
        console.error('[syncClient] response error:', err);
        reject(err);
      });
    });

    req.on('error', (err: Error) => {
      console.error('[syncClient] request error:', err);
      reject(err);
    });

    if (payload) {
      req.write(payload, 'utf-8');
    }
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

// ---------- Templates ----------

export interface CloudTemplateMeta {
  id: string;
  name: string;
  updatedAt: number;
}

export interface CloudTemplatePayload {
  id: string;
  name: string;
  updatedAt: number;
  payload: string;
}

export interface CloudTemplateListResult {
  success: boolean;
  templates?: CloudTemplateMeta[];
  error?: string;
}

export interface CloudTemplateGetResult {
  success: boolean;
  template?: CloudTemplatePayload;
  error?: string;
}

export interface CloudTemplatePushResult {
  success: boolean;
  template?: CloudTemplateMeta;
  error?: string;
}

export async function cloudListTemplates(): Promise<CloudTemplateListResult> {
  try {
    const { status, data } = await requestJson<{ templates?: CloudTemplateMeta[]; error?: string }>(
      'GET',
      '/sync/templates',
    );
    if (status === 200 && Array.isArray(data.templates)) {
      return { success: true, templates: data.templates };
    }
    if (status === 401) {
      return { success: false, error: '登录已过期，请重新登录' };
    }
    return { success: false, error: data.error || '获取云端模板失败' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '网络错误';
    return { success: false, error: msg };
  }
}

export async function cloudGetTemplate(templateId: string): Promise<CloudTemplateGetResult> {
  try {
    const { status, data } = await requestJson<CloudTemplatePayload & { error?: string }>(
      'GET',
      `/sync/templates/${encodeURIComponent(templateId)}`,
    );
    if (status === 200 && data.payload) {
      return { success: true, template: data };
    }
    if (status === 404) {
      return { success: false, error: '云端模板不存在' };
    }
    if (status === 401) {
      return { success: false, error: '登录已过期，请重新登录' };
    }
    return { success: false, error: data.error || '获取云端模板失败' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '网络错误';
    return { success: false, error: msg };
  }
}

export async function cloudPushTemplate(templateId: string, name: string, payload: string): Promise<CloudTemplatePushResult> {
  try {
    const { status, data } = await requestJson<CloudTemplateMeta & { error?: string }>(
      'PUT',
      `/sync/templates/${encodeURIComponent(templateId)}`,
      { name, payload },
    );
    if (status === 200) {
      return { success: true, template: data };
    }
    if (status === 413) {
      return { success: false, error: '模板数据超过 5MB 上限' };
    }
    if (status === 401) {
      return { success: false, error: '登录已过期，请重新登录' };
    }
    return { success: false, error: data.error || '上传模板失败' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '网络错误';
    return { success: false, error: msg };
  }
}

export async function cloudDeleteTemplate(templateId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { status, data } = await requestJson<{ success?: boolean; error?: string }>(
      'DELETE',
      `/sync/templates/${encodeURIComponent(templateId)}`,
    );
    if (status === 200) {
      return { success: true };
    }
    if (status === 404) {
      return { success: false, error: '云端模板不存在' };
    }
    if (status === 401) {
      return { success: false, error: '登录已过期，请重新登录' };
    }
    return { success: false, error: (data as any).error || '删除模板失败' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '网络错误';
    return { success: false, error: msg };
  }
}

// ──────────── Square / 角色广场 ────────────

export interface SquareCharacterMeta {
  id: string;
  name: string;
  userName: string;
  portraitBase64?: string;
  portraitFullBase64?: string;
  personality?: string;
  background?: string;
  gender?: string;
  occupation?: string;
  heat: number;
  isFavorited: boolean;
  updatedAt: number;
}

export interface SquareModelMeta {
  id: string;
  name: string;
  userName: string;
  provider: string;
  baseUrl: string;
  modelId: string;
  contextWindow: number;
  shared: boolean;
  updatedAt: number;
}

export interface SquareCharacterListResult {
  success: boolean;
  characters?: SquareCharacterMeta[];
  error?: string;
}

export interface SquareModelListResult {
  success: boolean;
  models?: SquareModelMeta[];
  error?: string;
}

export interface SquareToggleResult {
  success: boolean;
  shared?: boolean;
  error?: string;
}

export async function squareListCharacters(): Promise<SquareCharacterListResult> {
  try {
    const { status, data } = await requestJson<{ characters?: SquareCharacterMeta[]; error?: string }>(
      'GET',
      '/square/characters',
    );
    if (status === 200 && Array.isArray(data.characters)) {
      return { success: true, characters: data.characters };
    }
    return { success: false, error: data.error || '获取广场角色失败' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '网络错误';
    return { success: false, error: msg };
  }
}

export async function squareListModels(): Promise<SquareModelListResult> {
  try {
    const { status, data } = await requestJson<{ models?: SquareModelMeta[]; error?: string }>(
      'GET',
      '/square/models',
    );
    if (status === 200 && Array.isArray(data.models)) {
      return { success: true, models: data.models };
    }
    return { success: false, error: data.error || '获取广场模型失败' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '网络错误';
    return { success: false, error: msg };
  }
}

export async function squareToggleCharacterShared(characterId: string): Promise<SquareToggleResult> {
  try {
    const { status, data } = await requestJson<{ shared?: boolean; error?: string }>(
      'POST',
      `/square/characters/${encodeURIComponent(characterId)}/toggle`,
    );
    if (status === 200) {
      return { success: true, shared: data.shared };
    }
    if (status === 401) {
      return { success: false, error: '登录已过期，请重新登录' };
    }
    return { success: false, error: data.error || '切换分享失败' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '网络错误';
    return { success: false, error: msg };
  }
}

export async function squareToggleModelShared(modelId: string): Promise<SquareToggleResult> {
  try {
    const { status, data } = await requestJson<{ shared?: boolean; error?: string }>(
      'POST',
      `/square/models/${encodeURIComponent(modelId)}/toggle`,
    );
    if (status === 200) {
      return { success: true, shared: data.shared };
    }
    if (status === 401) {
      return { success: false, error: '登录已过期，请重新登录' };
    }
    return { success: false, error: data.error || '切换分享失败' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '网络错误';
    return { success: false, error: msg };
  }
}

export interface SquarePushModelArgs {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  modelId: string;
  contextWindow?: number;
}

export async function squarePushModel(args: SquarePushModelArgs): Promise<{ success: boolean; error?: string }> {
  try {
    const { status, data } = await requestJson<{ id?: string; error?: string }>(
      'PUT',
      `/square/models/${encodeURIComponent(args.id)}`,
      {
        name: args.name,
        provider: args.provider,
        baseUrl: args.baseUrl,
        modelId: args.modelId,
        contextWindow: args.contextWindow ?? 64000,
      },
    );
    if (status === 200) {
      return { success: true };
    }
    if (status === 401) {
      return { success: false, error: '登录已过期，请重新登录' };
    }
    return { success: false, error: data.error || '上传模型失败' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '网络错误';
    return { success: false, error: msg };
  }
}

export async function squareDeleteModel(modelId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { status, data } = await requestJson<{ success?: boolean; error?: string }>(
      'DELETE',
      `/square/models/${encodeURIComponent(modelId)}`,
    );
    if (status === 200) {
      return { success: true };
    }
    if (status === 401) {
      return { success: false, error: '登录已过期，请重新登录' };
    }
    return { success: false, error: (data as any).error || '删除模型失败' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '网络错误';
    return { success: false, error: msg };
  }
}

export async function squareListMyModels(): Promise<SquareModelListResult> {
  try {
    const { status, data } = await requestJson<{ models?: SquareModelMeta[]; error?: string }>(
      'GET',
      '/square/models/mine',
    );
    if (status === 200 && Array.isArray(data.models)) {
      return { success: true, models: data.models };
    }
    if (status === 401) {
      return { success: false, error: '登录已过期，请重新登录' };
    }
    return { success: false, error: data.error || '获取我的模型失败' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '网络错误';
    return { success: false, error: msg };
  }
}

export interface SquareFavoriteResult {
  success: boolean;
  favorited?: boolean;
  error?: string;
}

export async function squareFavoriteCharacter(characterId: string): Promise<SquareFavoriteResult> {
  try {
    const { status, data } = await requestJson<{ favorited?: boolean; error?: string }>(
      'POST',
      `/square/characters/${encodeURIComponent(characterId)}/favorite`,
    );
    if (status === 200) {
      return { success: true, favorited: data.favorited };
    }
    if (status === 401) {
      return { success: false, error: '登录已过期，请重新登录' };
    }
    return { success: false, error: data.error || '收藏操作失败' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '网络错误';
    return { success: false, error: msg };
  }
}

export async function squareListFavorites(): Promise<SquareCharacterListResult> {
  try {
    const { status, data } = await requestJson<{ characters?: SquareCharacterMeta[]; error?: string }>(
      'GET',
      '/square/favorites',
    );
    if (status === 200 && Array.isArray(data.characters)) {
      return { success: true, characters: data.characters };
    }
    if (status === 401) {
      return { success: false, error: '登录已过期，请重新登录' };
    }
    return { success: false, error: data.error || '获取收藏列表失败' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '网络错误';
    return { success: false, error: msg };
  }
}

// ── Template Square ──

export interface SquareTemplateMeta {
  id: string;
  name: string;
  userName: string;
  portraitBase64?: string;
  portraitFullBase64?: string;
  personality?: string;
  background?: string;
  gender?: string;
  occupation?: string;
  updatedAt: number;
}

export interface SquareTemplateListResult {
  success: boolean;
  templates?: SquareTemplateMeta[];
  error?: string;
}

export async function squareListTemplates(): Promise<SquareTemplateListResult> {
  try {
    const { status, data } = await requestJson<{ templates?: SquareTemplateMeta[]; error?: string }>(
      'GET',
      '/square/templates',
    );
    if (status === 200 && Array.isArray(data.templates)) {
      return { success: true, templates: data.templates };
    }
    return { success: false, error: data.error || '获取广场模板失败' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '网络错误';
    return { success: false, error: msg };
  }
}

export async function squareToggleTemplateShared(templateId: string): Promise<SquareToggleResult> {
  try {
    const { status, data } = await requestJson<{ shared?: boolean; error?: string }>(
      'POST',
      `/square/templates/${encodeURIComponent(templateId)}/toggle`,
    );
    if (status === 200) {
      return { success: true, shared: data.shared };
    }
    if (status === 404) {
      return { success: false, error: '模板不存在（请先同步到云端）' };
    }
    if (status === 401) {
      return { success: false, error: '登录已过期，请重新登录' };
    }
    return { success: false, error: data.error || '切换分享状态失败' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '网络错误';
    return { success: false, error: msg };
  }
}
