import { net } from 'electron';
import { getAuthApiBase, getAuthToken } from '../security/authToken';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

function joinUrl(base: string, suffix: string): string {
  const normalized = base.trim().replace(/\/+$/, '');
  return `${normalized}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
}

export function getServerImageBaseUrl(): string {
  return getAuthApiBase().replace(/\/api$/, '');
}

async function apiRequest<T>(
  method: HttpMethod,
  apiPath: string,
  body?: unknown,
): Promise<T> {
  const baseUrl = getAuthApiBase();
  const token = getAuthToken();
  if (!token) throw new Error('未登录，无法上传图片');
  const url = joinUrl(baseUrl, apiPath);

  return new Promise((resolve, reject) => {
    const req = net.request({
      method,
      url,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    req.on('response', (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString('utf-8'); });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data) as T);
          } catch {
            reject(new Error(`解析响应失败: ${data.slice(0, 200)}`));
          }
        } else {
          let msg = data;
          try { msg = JSON.parse(data).error || data; } catch {}
          reject(new Error(msg.slice(0, 500) || `HTTP ${res.statusCode}`));
        }
      });
      res.on('error', reject);
    });
    req.on('error', reject);

    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

export async function uploadPortrait(base64DataUrl: string): Promise<string> {
  const result = await apiRequest<{ url: string }>('POST', '/images/upload', {
    image: base64DataUrl,
  });
  const fullUrl = `https://dominusgame.top${result.url}`;
  return fullUrl;
}
