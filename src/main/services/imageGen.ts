import https from 'https';
import http from 'http';
import { infoLog, warnLog, errorLog } from '../logger';
import { maskSecret, truncateText, summarizeUrls, summarizeJsonForLog } from './log-sanitize';

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

export function buildImageGenerationUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  const path = base.endsWith('/v1') ? '/images/generations' : '/v1/images/generations';
  return base + path;
}

function pushBase64(urls: string[], value: unknown, mime = 'image/png') {
  if (typeof value !== 'string' || !value.trim()) return;
  const raw = value.trim();
  if (raw.startsWith('data:')) {
    urls.push(raw);
    return;
  }
  urls.push(`data:${mime};base64,${raw}`);
}

function pushUrl(urls: string[], value: unknown) {
  if (typeof value === 'string' && value.trim()) urls.push(value.trim());
}

function collectFromItems(urls: string[], items: unknown) {
  if (!Array.isArray(items)) return;
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    pushUrl(urls, row.url);
    pushUrl(urls, row.image_url);
    pushUrl(urls, row.imageUrl);
    pushBase64(urls, row.b64_json);
    pushBase64(urls, row.b64_image);
    pushBase64(urls, row.base64);
    pushBase64(urls, row.image);
  }
}

/** 兼容 OpenAI 及常见中转站生图响应格式 */
export function parseImageGenerationResponse(parsed: unknown): GenerateImageResult {
  const urls: string[] = [];
  let revisedPrompt: string | undefined;

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('生图 API 返回格式无效');
  }
  const root = parsed as Record<string, unknown>;

  collectFromItems(urls, root.data);
  collectFromItems(urls, root.images);
  collectFromItems(urls, root.output);

  const nestedData = root.data;
  if (nestedData && typeof nestedData === 'object' && !Array.isArray(nestedData)) {
    const row = nestedData as Record<string, unknown>;
    pushUrl(urls, row.url);
    pushUrl(urls, row.image_url);
    pushBase64(urls, row.b64_json);
    pushBase64(urls, row.b64_image);
    pushBase64(urls, row.base64);
  }

  const result = root.result;
  if (result && typeof result === 'object') {
    collectFromItems(urls, (result as Record<string, unknown>).data);
  }

  pushUrl(urls, root.url);
  pushUrl(urls, root.image_url);
  pushBase64(urls, root.b64_json);
  pushBase64(urls, root.b64_image);
  pushBase64(urls, root.base64);
  pushBase64(urls, root.image);

  if (Array.isArray(root.data) && root.data[0] && typeof root.data[0] === 'object') {
    const rp = (root.data[0] as Record<string, unknown>).revised_prompt;
    if (typeof rp === 'string') revisedPrompt = rp;
  }

  const unique = [...new Set(urls)];
  if (unique.length === 0) {
    const keys = Object.keys(root).slice(0, 8).join(', ') || 'empty';
    throw new Error(`生图 API 未返回图片（响应字段: ${keys}）`);
  }

  return { urls: unique, revisedPrompt };
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
  signal?: AbortSignal,
  logContext = 'imageGen',
): Promise<GenerateImageResult> {
  // 修复：使用字符串拼接替代 new URL(path, base) 避免路径段被替换
  const url = new URL(buildImageGenerationUrl(config.baseUrl));
  const isHttps = url.protocol === 'https:';

  const payload = {
    model: config.model || 'gpt-image-1',
    prompt: args.prompt,
    n: Math.min(Math.max(args.n ?? 1, 1), 4),
    size: args.size || '1024x1024',
    quality: args.quality || 'standard',
  };
  const body = JSON.stringify(payload);

  infoLog('imageGen', 'request', {
    context: logContext,
    endpoint: url.toString(),
    model: payload.model,
    size: payload.size,
    quality: payload.quality,
    n: payload.n,
    apiKey: maskSecret(config.apiKey),
    promptPreview: truncateText(args.prompt, 300),
    promptLength: args.prompt.length,
  });

  const maxRetries = 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, 500 * attempt));
      warnLog('imageGen', 'retry', { context: logContext, attempt, maxRetries });
    }

    try {
      const result = await doRequest(attempt);
      infoLog('imageGen', 'response-ok', {
        context: logContext,
        urlCount: result.urls.length,
        urls: summarizeUrls(result.urls),
        revisedPromptPreview: result.revisedPrompt ? truncateText(result.revisedPrompt, 200) : undefined,
      });
      return result;
    } catch (err: unknown) {
      lastError = err;
      errorLog('imageGen', 'response-error', {
        context: logContext,
        attempt,
        error: err instanceof Error ? err.message : String(err),
      });
      if (!isRetryableError(err) || attempt >= maxRetries || signal?.aborted) {
        throw err;
      }
    }
  }

  throw lastError;

  async function doRequest(attempt: number): Promise<GenerateImageResult> {
  const started = Date.now();
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
        const elapsedMs = Date.now() - started;
        if (status < 200 || status >= 300) {
          let detail = buf.trim();
          try {
            const parsed = JSON.parse(detail);
            detail = parsed.error?.message || parsed.message || detail;
          } catch {}
          errorLog('imageGen', 'http-error', {
            context: logContext,
            attempt,
            status,
            elapsedMs,
            bodyPreview: summarizeJsonForLog(buf),
            message: detail || res.statusMessage || '未知错误',
          });
          reject(new Error(`生图 API ${status}: ${detail || res.statusMessage || '未知错误'}`));
          return;
        }
        try {
          const parsed = JSON.parse(buf);
          infoLog('imageGen', 'response-body', {
            context: logContext,
            attempt,
            status,
            elapsedMs,
            bodyPreview: summarizeJsonForLog(buf),
          });
          resolve(parseImageGenerationResponse(parsed));
        } catch (err: any) {
          if (err instanceof Error && err.message.includes('生图 API')) {
            errorLog('imageGen', 'parse-empty', {
              context: logContext,
              attempt,
              elapsedMs,
              bodyPreview: summarizeJsonForLog(buf),
              error: err.message,
            });
            reject(err);
            return;
          }
          errorLog('imageGen', 'parse-failed', {
            context: logContext,
            attempt,
            elapsedMs,
            bodyPreview: summarizeJsonForLog(buf),
            error: err?.message || String(err),
          });
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
      errorLog('imageGen', 'timeout', {
        context: logContext,
        attempt,
        elapsedMs: Date.now() - started,
        endpoint: url.toString(),
      });
      req.destroy();
      reject(new Error('生图请求超时（300秒），请检查网络或稍后重试'));
    });

    req.on('error', (err) => {
      signal?.removeEventListener('abort', onAbort);
      errorLog('imageGen', 'network-error', {
        context: logContext,
        attempt,
        elapsedMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      });
      reject(unwrapError(err, url.hostname));
    });
    req.write(body);
    req.end();
  });
  } // end doRequest
}
