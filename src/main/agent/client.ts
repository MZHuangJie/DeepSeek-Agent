import https from 'https';
import http from 'http';
import type { ChatMessage, ToolCallResult } from './types';
import { debugLog } from '../logger';

// VPN TUN 模式下需要显式 SNI + 禁用连接复用，否则 TLS 握手阶段 ECONNRESET
const httpsAgent = new https.Agent({
  keepAlive: false,
  maxSockets: 1,
});

function isRetryableError(err: unknown): boolean {
  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    // ECONNRESET: VPN TUN 模式下 TLS 握手被重置
    // ETIMEDOUT: 网络超时
    // ECONNREFUSED: 连接被拒绝（可能临时）
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
          const code = errno.code;
          const addr = errno.address;
          const port = errno.port;
          const parts = [code, addr ? `${addr}${port ? ':' + port : ''}` : '', e.message]
            .filter(Boolean);
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

export interface StreamCallbacks {
  onContent: (text: string) => void;
  onThinking: (text: string) => void;
}

export interface StreamResult {
  content: string;
  thinking: string;
  toolCalls: Array<{ id: string; name: string; arguments: string }>;
  finishReason?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
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
  signal?: AbortSignal
): Promise<StreamResult> {
  const { model, baseUrl } = modelConfig;
  const url = new URL('/v1/chat/completions', baseUrl);
  if (url.protocol !== 'https:') {
    throw new Error('API base URL must use HTTPS for security');
  }
  const isHttps = true;

  const bodyObj: Record<string, unknown> = {
    model,
    messages,
    stream: true,
    stream_options: { include_usage: true },
  };
  if (tools.length > 0) {
    bodyObj.tools = tools;
  }
  const body = JSON.stringify(bodyObj);

  debugLog('[streamChat]', 'start', { msgCount: messages.length, bodyLen: body.length, toolCount: tools.length });

  const maxRetries = 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // 重试前等一小会儿，让 VPN 隧道稳定
      await new Promise(r => setTimeout(r, 500 * attempt));
      debugLog(`[DEBUG streamChat] retry attempt ${attempt}/${maxRetries}`);
    }

    try {
      return await doStreamRequest();
    } catch (err: unknown) {
      lastError = err;
      if (!isRetryableError(err) || attempt >= maxRetries || signal?.aborted) {
        throw err;
      }
    }
  }

  throw lastError;

  async function doStreamRequest(): Promise<StreamResult> {
  return new Promise((resolve, reject) => {
    const options: https.RequestOptions & { hostname: string } = {
      hostname: url.hostname,
      servername: url.hostname, // VPN TUN 模式下确保 TLS SNI 正确
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      agent: httpsAgent,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'text/event-stream',
      },
    };

    const requestFn = isHttps ? https.request : http.request;

    const result: StreamResult = { content: '', thinking: '', toolCalls: [] };

    // 流式请求的两道超时防线：
    // 1) firstByteTimer: 发请求后 30s 内必须收到响应头，否则 abort（防 TLS/连接静默挂起）
    // 2) idleTimer: 收到响应后，如果 60s 没有任何 chunk 进来就 abort（防中途 TCP 静默断流）
    const FIRST_BYTE_TIMEOUT_MS = 30_000;
    const IDLE_TIMEOUT_MS = 60_000;
    const IDLE_CHECK_INTERVAL_MS = 5_000;
    let lastChunkAt = Date.now();
    let firstByteTimer: NodeJS.Timeout | null = null;
    let idleTimer: NodeJS.Timeout | null = null;
    const clearTimers = () => {
      if (firstByteTimer) { clearTimeout(firstByteTimer); firstByteTimer = null; }
      if (idleTimer) { clearInterval(idleTimer); idleTimer = null; }
    };

    const req = requestFn(options, (res) => {
      // 响应头到了，first-byte 阶段过关；切换到 idle 监控
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
          try {
            const parsed = JSON.parse(detail);
            detail = parsed.error?.message || parsed.message || detail;
          } catch {}
          const wrapped = new Error(`API ${status}: ${detail || res.statusMessage || '未知错误'}`);
          wrapped.name = 'ApiError';
          reject(wrapped);
        });
        res.on('error', (err) => { clearTimers(); reject(unwrapNetworkError(err, url.hostname)); });
        return;
      }

      let buffer = '';
      const toolCallsAccum = new Map<number, { id: string; name: string; arguments: string }>();
      let lastToolCallIndex = -1;
      let hasFlushed = false;

      res.on('data', (chunk: Buffer) => {
        lastChunkAt = Date.now();
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.usage) {
              result.usage = parsed.usage;
            }
            const choice = parsed.choices?.[0];
            if (!choice) continue;

            if (choice.delta?.reasoning_content) {
              result.thinking += choice.delta.reasoning_content;
              callbacks.onThinking(choice.delta.reasoning_content);
            }
            if (choice.delta?.content) {
              result.content += choice.delta.content;
              callbacks.onContent(choice.delta.content);
            }
            if (choice.delta?.tool_calls) {
              for (const tc of choice.delta.tool_calls) {
                const idx = tc.index ?? 0;
                const existing = toolCallsAccum.get(idx) || { id: tc.id || '', name: '', arguments: '' };
                if (tc.id) existing.id = tc.id;
                if (tc.function?.name) existing.name = tc.function.name;
                if (tc.function?.arguments !== undefined) existing.arguments += tc.function.arguments;
                toolCallsAccum.set(idx, existing);
                lastToolCallIndex = Math.max(lastToolCallIndex, idx);
              }
            }
            if (choice.finish_reason) {
              result.finishReason = choice.finish_reason;
            }
            if (!hasFlushed && (choice.finish_reason === 'tool_calls' || choice.finish_reason === 'stop' || choice.finish_reason === 'length')) {
              hasFlushed = true;
              for (let i = 0; i <= lastToolCallIndex; i++) {
                const tc = toolCallsAccum.get(i);
                if (tc && tc.name) {
                  result.toolCalls.push({ id: tc.id || `call_${i}`, name: tc.name, arguments: tc.arguments || '{}' });
                }
              }
            }
          } catch {}
        }
      });
      res.on('end', () => {
        clearTimers();
        if (!hasFlushed) {
          for (let i = 0; i <= lastToolCallIndex; i++) {
            const tc = toolCallsAccum.get(i);
            if (tc && tc.name) {
              const already = result.toolCalls.find(t => t.id === tc.id);
              if (!already) {
                result.toolCalls.push({ id: tc.id || `call_${i}`, name: tc.name, arguments: tc.arguments || '{}' });
              }
            }
          }
        }
        resolve(result);
      });
      res.on('error', (err) => { clearTimers(); reject(unwrapNetworkError(err, url.hostname)); });
    });
    req.on('error', (err) => {
      clearTimers();
      if ((err as any).name === 'AbortError' || (signal?.aborted)) {
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
    // first-byte 超时：socket 写出后还没收到响应头就 abort
    firstByteTimer = setTimeout(() => {
      const e = new Error(`First byte timeout: ${FIRST_BYTE_TIMEOUT_MS / 1000} 秒内未收到 API 响应`);
      (e as NodeJS.ErrnoException).code = 'ETIMEDOUT';
      req.destroy(e);
    }, FIRST_BYTE_TIMEOUT_MS);
    req.write(body);
    req.end();
  });
  } // end doStreamRequest
}
