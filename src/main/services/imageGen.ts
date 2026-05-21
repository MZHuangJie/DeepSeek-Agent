import https from 'https';
import http from 'http';

// VPN TUN 模式下需要显式 SNI + 禁用连接复用
const httpsAgent = new https.Agent({
  keepAlive: false,
  maxSockets: 1,
});

function isRetryableError(err: unknown): boolean {
  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNREFUSED') return true;
  }
  return false;
}

export interface ImageModelConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface GenerateImageArgs {
  prompt: string;
  size?: string;
  quality?: string;
  n?: number;
}

export interface GenerateImageResult {
  urls: string[];
  revisedPrompt?: string;
}

function unwrapError(err: unknown, hostname: string): Error {
  if (err instanceof Error && err.name === 'AggregateError') {
    const errors = (err as unknown as { errors?: unknown[] }).errors;
    if (Array.isArray(errors) && errors.length > 0) {
      const messages = errors.map((e) => {
        if (e instanceof Error) {
          const errno = e as NodeJS.ErrnoException & { address?: string; port?: number };
          return [errno.code, errno.address ? `${errno.address}${errno.port ? ':' + errno.port : ''}` : '', e.message]
            .filter(Boolean).join(' ');
        }
        return String(e);
      });
      return new Error(`无法连接到 ${hostname}：\n${messages.join('\n')}`);
    }
  }
  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code) return new Error(`${code}: ${err.message} (${hostname})`);
    return err;
  }
  return new Error(String(err));
}

export async function generateImage(
  config: ImageModelConfig,
  args: GenerateImageArgs,
  signal?: AbortSignal
): Promise<GenerateImageResult> {
  const url = new URL('/v1/images/generations', config.baseUrl);
  const isHttps = url.protocol === 'https:';

  const body = JSON.stringify({
    model: config.model || 'gpt-image-1',
    prompt: args.prompt,
    n: Math.min(Math.max(args.n ?? 1, 1), 4),
    size: args.size || '1024x1024',
    quality: args.quality || 'standard',
  });

  const maxRetries = 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, 500 * attempt));
    }

    try {
      return await doRequest();
    } catch (err: unknown) {
      lastError = err;
      if (!isRetryableError(err) || attempt >= maxRetries || signal?.aborted) {
        throw err;
      }
    }
  }

  throw lastError;

  async function doRequest(): Promise<GenerateImageResult> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const onAbort = () => {
      req.destroy(new Error('Aborted'));
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    const options: https.RequestOptions & { hostname: string } = {
      hostname: url.hostname,
      servername: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      agent: httpsAgent,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
    };

    const requestFn = isHttps ? https.request : http.request;

    const req = requestFn(options, (res) => {
      const status = res.statusCode ?? 0;
      let buf = '';
      res.setEncoding('utf-8');
      res.on('data', (c: string) => { buf += c; });
      res.on('end', () => {
        signal?.removeEventListener('abort', onAbort);
        if (status < 200 || status >= 300) {
          let detail = buf.trim();
          try {
            const parsed = JSON.parse(detail);
            detail = parsed.error?.message || parsed.message || detail;
          } catch {}
          reject(new Error(`生图 API ${status}: ${detail || res.statusMessage || '未知错误'}`));
          return;
        }
        try {
          const parsed = JSON.parse(buf);
          const urls: string[] = [];
          for (const item of parsed.data ?? []) {
            if (item.url) urls.push(item.url);
            if (item.b64_json) {
              urls.push(`data:image/png;base64,${item.b64_json}`);
            }
          }
          resolve({
            urls,
            revisedPrompt: parsed.data?.[0]?.revised_prompt,
          });
        } catch (err: any) {
          reject(new Error(`解析生图响应失败: ${err.message}`));
        }
      });
      res.on('error', (err) => {
        signal?.removeEventListener('abort', onAbort);
        reject(unwrapError(err, url.hostname));
      });
    });

    req.setTimeout(300000, () => {
      signal?.removeEventListener('abort', onAbort);
      req.destroy();
      reject(new Error('生图请求超时（300秒），请检查网络或稍后重试'));
    });

    req.on('error', (err) => {
      signal?.removeEventListener('abort', onAbort);
      reject(unwrapError(err, url.hostname));
    });
    req.write(body);
    req.end();
  });
  } // end doRequest
}
