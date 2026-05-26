import https from 'https';
import http from 'http';
import type { ChatMessage } from './types';
import type { Provider, ParseState, StreamCallbacks } from './providers/types';
import { createParseState, selectProvider } from './providers';
import { classifyApiError } from './errors';
import { log } from '../logger';

const httpsAgent = new https.Agent({ keepAlive: false });
// keepAlive: false — 每次请求独立建连，避免中转站/代理的粘滞连接问题
// maxSockets 使用 Node.js 默认值 (Infinity)，不做限制，避免并行子代理时排队阻塞

function isRetryableError(err: unknown): boolean {
  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNREFUSED') return true;
  }
  return false;
}

function unwrapNetworkError(err: unknown, hostname: string): Error {
  if (err instanceof Error && err.name === 'AggregateError') {
    const errors = (err as unknown as { errors?: unknown[] }).errors;
    if (Array.isArray(errors) && errors.length > 0) {
      const messages = errors.map((e) => {
        if (e instanceof Error) {
          const errno = e as NodeJS.ErrnoException & { address?: string; port?: number };
          const parts = [errno.code, errno.address, e.message].filter(Boolean);
          return parts.join(' ');
        }
        return String(e);
      });
      const wrapped = new Error(`无法连接到 ${hostname}：\n${messages.join('\n')}`);
      wrapped.name = 'NetworkError';
      return wrapped;
    }
  }
  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code) {
      const wrapped = new Error(`${code}: ${err.message} (${hostname})`);
      wrapped.name = 'NetworkError';
      return wrapped;
    }
    return err;
  }
  return new Error(String(err));
}

export interface StreamResult {
  content: string;
  thinking: string;
  toolCalls: Array<{ id: string; name: string; arguments: string }>;
  finishReason?: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface ModelConfig {
  model: string;
  baseUrl: string;
}

export async function streamChat(
  apiKey: string,
  messages: ChatMessage[],
  tools: Array<Record<string, unknown>>,
  modelConfig: ModelConfig,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  provider?: Provider,
): Promise<StreamResult> {
  const { model, baseUrl } = modelConfig;
  const apiPath = baseUrl.endsWith('/v1') ? '/chat/completions' : '/v1/chat/completions';
  const url = new URL(apiPath, baseUrl);
  if (url.protocol !== 'https:') {
    throw new Error('API base URL must use HTTPS for security');
  }

  const effectiveProvider = provider ?? selectProvider(model, baseUrl);

  const bodyObj: Record<string, unknown> = { model, messages, stream: true, stream_options: { include_usage: true } };
  if (tools.length > 0) bodyObj.tools = tools;
  const body = JSON.stringify(bodyObj);

  log('debug', 'client', 'streamChat 开始', { model, msgCount: messages.length, toolCount: tools.length });

  const maxRetries = 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, 500 * attempt));
      log('debug', 'client', 'streamChat 重试', { attempt, maxRetries });
    }
    try {
      return await doStreamRequest();
    } catch (err: unknown) {
      lastError = err;
      if (!isRetryableError(err) || attempt >= maxRetries || signal?.aborted) throw err;
    }
  }
  throw lastError;

  async function doStreamRequest(): Promise<StreamResult> {
    return new Promise((resolve, reject) => {
      const options: https.RequestOptions & { hostname: string } = {
        hostname: url.hostname,
        servername: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: 'POST',
        agent: httpsAgent,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'text/event-stream',
        },
      };

      const state: ParseState = createParseState();
      const result: StreamResult = { content: '', thinking: '', toolCalls: [] };

      const FIRST_BYTE_TIMEOUT_MS = 30_000;
      const IDLE_TIMEOUT_MS = 60_000;
      const IDLE_CHECK_INTERVAL_MS = 5_000;
      let lastChunkAt = Date.now();
      let firstByteTimer: NodeJS.Timeout | null = null;
      let idleTimer: NodeJS.Timeout | null = null;
      let hasFlushed = false;

      const clearTimers = () => {
        if (firstByteTimer) { clearTimeout(firstByteTimer); firstByteTimer = null; }
        if (idleTimer) { clearInterval(idleTimer); idleTimer = null; }
      };

      const flushToolCalls = () => {
        let added = false;
        for (let i = 0; i <= state.lastToolCallIndex; i++) {
          const tc = state.toolCallsAccum.get(i);
          if (tc && tc.name && !result.toolCalls.find(t => t.id === tc.id)) {
            result.toolCalls.push({ id: tc.id || `call_${i}`, name: tc.name, arguments: tc.arguments || '{}' });
            added = true;
          }
        }
        if (added) hasFlushed = true;
      };

      const req = https.request(options, (res) => {
        if (firstByteTimer) { clearTimeout(firstByteTimer); firstByteTimer = null; }
        lastChunkAt = Date.now();
        idleTimer = setInterval(() => {
          if (Date.now() - lastChunkAt > IDLE_TIMEOUT_MS) {
            const e = new Error(`Stream idle timeout: API 流静默超过 ${IDLE_TIMEOUT_MS / 1000} 秒`);
            (e as NodeJS.ErrnoException).code = 'ETIMEDOUT';
            req.destroy(e);
          }
        }, IDLE_CHECK_INTERVAL_MS);

        const status = res.statusCode ?? 0;
        if (status < 200 || status >= 300) {
          let errBuf = '';
          res.setEncoding('utf-8');
          res.on('data', (c: string) => { lastChunkAt = Date.now(); errBuf += c; });
          res.on('end', () => {
            clearTimers();
            let detail = errBuf.trim();
            try { const p = JSON.parse(detail); detail = p.error?.message || p.message || detail; } catch {}
            reject(classifyApiError(status, detail || res.statusMessage || '未知错误'));
          });
          res.on('error', (err) => { clearTimers(); reject(unwrapNetworkError(err, url.hostname)); });
          return;
        }

        let buffer = '';

        res.on('data', (chunk: Buffer) => {
          lastChunkAt = Date.now();
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(dataStr);
              effectiveProvider.parseChunk(parsed, state, callbacks);
              if (!hasFlushed && effectiveProvider.shouldFlush(parsed)) {
                flushToolCalls();
              }
            } catch { /* skip unparseable chunks */ }
          }
        });

        res.on('end', () => {
          clearTimers();
          effectiveProvider.finalize(state);
          flushToolCalls(); // finalize 可能从文本中解析出新工具，始终尝试 flush
          result.content = state.content;
          result.thinking = state.thinking;
          result.finishReason = state.finishReason;
          result.usage = state.usage;
          resolve(result);
        });

        res.on('error', (err) => { clearTimers(); reject(unwrapNetworkError(err, url.hostname)); });
      });

      req.on('error', (err) => {
        clearTimers();
        if ((err as any).name === 'AbortError' || signal?.aborted) {
          resolve(result);
        } else {
          reject(unwrapNetworkError(err, url.hostname));
        }
      });

      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimers();
          const err = new Error('Request aborted');
          err.name = 'AbortError';
          req.destroy(err);
        }, { once: true });
        signal.throwIfAborted();
      }

      firstByteTimer = setTimeout(() => {
        const e = new Error(`First byte timeout: ${FIRST_BYTE_TIMEOUT_MS / 1000} 秒内未收到 API 响应`);
        (e as NodeJS.ErrnoException).code = 'ETIMEDOUT';
        req.destroy(e);
      }, FIRST_BYTE_TIMEOUT_MS);

      req.write(body);
      req.end();
    });
  }
}

export async function completeChat(
  apiKey: string,
  messages: ChatMessage[],
  modelConfig: ModelConfig,
  options?: { maxTokens?: number; temperature?: number; signal?: AbortSignal },
): Promise<string> {
  const { model, baseUrl } = modelConfig;
  const base = baseUrl.replace(/\/+$/, '');
  const path = base.endsWith('/v1') ? '/chat/completions' : '/v1/chat/completions';
  const url = new URL(base + path);
  if (url.protocol !== 'https:') {
    throw new Error('API base URL must use HTTPS for security');
  }

  const body = JSON.stringify({
    model,
    messages,
    stream: false,
    max_tokens: options?.maxTokens ?? 40,
    temperature: options?.temperature ?? 0.3,
  });

  return new Promise((resolve, reject) => {
    const reqOptions: https.RequestOptions & { hostname: string } = {
      hostname: url.hostname,
      servername: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'POST',
      agent: httpsAgent,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    };

    const req = https.request(reqOptions, (res) => {
      const status = res.statusCode ?? 0;
      let buf = '';
      res.setEncoding('utf-8');
      res.on('data', (c: string) => { buf += c; });
      res.on('end', () => {
        if (status < 200 || status >= 300) {
          let detail = buf.trim();
          try {
            const parsed = JSON.parse(detail);
            detail = parsed.error?.message || parsed.message || detail;
          } catch {}
          reject(classifyApiError(status, detail || res.statusMessage || '未知错误'));
          return;
        }
        try {
          const parsed = JSON.parse(buf);
          const message = parsed.choices?.[0]?.message;
          const content = message?.content || message?.reasoning_content || '';
          resolve(typeof content === 'string' ? content : '');
        } catch (err: unknown) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });
      res.on('error', (err) => reject(unwrapNetworkError(err, url.hostname)));
    });

    req.on('error', (err) => reject(unwrapNetworkError(err, url.hostname)));

    if (options?.signal) {
      options.signal.addEventListener('abort', () => {
        req.destroy(new Error('Request aborted'));
      }, { once: true });
      if (options.signal.aborted) {
        req.destroy(new Error('Request aborted'));
        return;
      }
    }

    req.setTimeout(20_000, () => {
      req.destroy(new Error('标题生成请求超时'));
    });

    req.write(body);
    req.end();
  });
}
