import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';

export interface VisionModelConfig {
  enabled?: boolean;
  baseUrl: string;
  model: string;
  apiKey: string;
  useActiveModel?: boolean;
}

interface ImagePayload {
  mime: string;
  base64: string;
  userPrompt: string;
}

function loadImagePayload(imagePath: string, prompt?: string): ImagePayload {
  const absPath = path.resolve(imagePath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`图片文件不存在: ${imagePath}`);
  }

  const buf = fs.readFileSync(absPath);
  const ext = path.extname(absPath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
  };
  const mime = mimeMap[ext] || 'image/png';
  const userPrompt = prompt || '请详细描述这张图片的内容，包括画面主体、场景、文字、颜色等所有可见信息。用中文回复。';

  return { mime, base64: buf.toString('base64'), userPrompt };
}

function isAnthropicVision(config: VisionModelConfig): boolean {
  return config.baseUrl.includes('anthropic.com') || config.model.toLowerCase().includes('claude');
}

function httpJsonRequest(
  url: URL,
  headers: Record<string, string>,
  body: string,
  signal?: AbortSignal,
  parseText: (data: string) => string = (data) => {
    const parsed = JSON.parse(data);
    return parsed.choices?.[0]?.message?.content || '无法获取图片描述';
  },
): Promise<string> {
  const isHttps = url.protocol === 'https:';

  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));

    const onAbort = () => {
      req.destroy(new Error('Aborted'));
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers,
    };

    const requestFn = isHttps ? https.request : http.request;
    const req = requestFn(options, (res) => {
      const status = res.statusCode ?? 0;
      let data = '';
      res.setEncoding('utf-8');
      res.on('data', (c: string) => { data += c; });
      res.on('end', () => {
        signal?.removeEventListener('abort', onAbort);
        if (status < 200 || status >= 300) {
          let detail = data.trim();
          try { const p = JSON.parse(detail); detail = p.error?.message || p.message || detail; } catch {}
          reject(new Error(`Vision API ${status}: ${detail.slice(0, 300)}`));
          return;
        }
        try {
          resolve(parseText(data));
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          reject(new Error(`解析 Vision 响应失败: ${msg}`));
        }
      });
      res.on('error', (err) => { signal?.removeEventListener('abort', onAbort); reject(err); });
    });

    req.on('error', (err) => { signal?.removeEventListener('abort', onAbort); reject(err); });
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Vision API 超时（60秒）')); });
    req.write(body);
    req.end();
  });
}

async function describeImageOpenAI(
  config: VisionModelConfig,
  payload: ImagePayload,
  signal?: AbortSignal,
): Promise<string> {
  const body = JSON.stringify({
    model: config.model,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: payload.userPrompt },
        { type: 'image_url', image_url: { url: `data:${payload.mime};base64,${payload.base64}` } },
      ],
    }],
    max_tokens: 1024,
  });

  const apiPath = config.baseUrl.endsWith('/v1') ? '/chat/completions' : '/v1/chat/completions';
  const url = new URL(apiPath, config.baseUrl);

  return httpJsonRequest(url, {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`,
  }, body, signal);
}

async function describeImageAnthropic(
  config: VisionModelConfig,
  payload: ImagePayload,
  signal?: AbortSignal,
): Promise<string> {
  const base = config.baseUrl.replace(/\/$/, '');
  const url = base.endsWith('/v1')
    ? new URL(`${base}/messages`)
    : new URL(`${base}/v1/messages`);

  const body = JSON.stringify({
    model: config.model,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: payload.mime, data: payload.base64 },
        },
        { type: 'text', text: payload.userPrompt },
      ],
    }],
  });

  return httpJsonRequest(url, {
    'Content-Type': 'application/json',
    'x-api-key': config.apiKey,
    'anthropic-version': '2023-06-01',
  }, body, signal, (data) => {
    const parsed = JSON.parse(data);
    const block = parsed.content?.find((b: { type?: string }) => b.type === 'text');
    return block?.text || '无法获取图片描述';
  });
}

export async function describeImage(
  config: VisionModelConfig,
  imagePath: string,
  prompt?: string,
  signal?: AbortSignal,
): Promise<string> {
  const payload = loadImagePayload(imagePath, prompt);
  if (isAnthropicVision(config)) {
    return describeImageAnthropic(config, payload, signal);
  }
  return describeImageOpenAI(config, payload, signal);
}
