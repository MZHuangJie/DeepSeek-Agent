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

export async function describeImage(
  config: VisionModelConfig,
  imagePath: string,
  prompt?: string,
  signal?: AbortSignal
): Promise<string> {
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
  const base64 = buf.toString('base64');
  const userPrompt = prompt || '请详细描述这张图片的内容，包括画面主体、场景、文字、颜色等所有可见信息。用中文回复。';

  const body = JSON.stringify({
    model: config.model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: userPrompt },
          { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
        ],
      },
    ],
    max_tokens: 1024,
  });

  const apiPath = config.baseUrl.endsWith('/v1') ? '/chat/completions' : '/v1/chat/completions';
  const url = new URL(apiPath, config.baseUrl);
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
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
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
          try { const p = JSON.parse(detail); detail = p.error?.message || detail; } catch {}
          reject(new Error(`Vision API ${status}: ${detail.slice(0, 300)}`));
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const text = parsed.choices?.[0]?.message?.content || '无法获取图片描述';
          resolve(text);
        } catch (e: any) {
          reject(new Error(`解析 Vision 响应失败: ${e.message}`));
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
