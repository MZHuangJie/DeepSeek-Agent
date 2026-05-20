import https from 'https';
import http from 'http';

export interface StreamCallbacks {
  onContent: (text: string) => void;
  onThinking: (text: string) => void;
}

export interface StreamResult {
  content: string;
  thinking: string;
  toolCalls: Array<{ id: string; name: string; arguments: string }>;
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
  messages: any[],
  tools: Array<unknown>,
  modelConfig: ModelConfig,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<StreamResult> {
  const { model, baseUrl } = modelConfig;
  const url = new URL('/v1/chat/completions', baseUrl);
  const isHttps = url.protocol === 'https:';

  const body = JSON.stringify({
    model,
    messages,
    tools,
    stream: true,
    stream_options: { include_usage: true },
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'text/event-stream',
      },
    };

    const requestFn = isHttps ? https.request : http.request;

    const result: StreamResult = { content: '', thinking: '', toolCalls: [] };

    const req = requestFn(options, (res) => {
      let buffer = '';
      const toolCallsAccum = new Map<number, { id: string; name: string; arguments: string }>();
      let lastToolCallIndex = -1;
      let hasFlushed = false;

      res.on('data', (chunk: Buffer) => {
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
            if (!hasFlushed && (choice.finish_reason === 'tool_calls' || choice.finish_reason === 'stop')) {
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
      res.on('error', reject);
    });
    req.on('error', (err) => {
      if ((err as any).name === 'AbortError' || (signal?.aborted)) {
        resolve(result);
      } else {
        reject(err);
      }
    });
    if (signal) {
      signal.addEventListener('abort', () => {
        const err = new Error('Request aborted');
        err.name = 'AbortError';
        req.destroy(err);
      }, { once: true });
      signal.throwIfAborted();
    }
    req.write(body);
    req.end();
  });
}
