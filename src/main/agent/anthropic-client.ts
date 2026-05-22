import https from 'https';

export interface StreamCallbacks {
  onContent: (text: string) => void;
  onThinking: (text: string) => void;
}

export interface StreamResult {
  content: string;
  thinking: string;
  toolCalls: Array<{ id: string; name: string; arguments: string }>;
  finishReason?: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

function buildAnthropicMessages(messages: any[]): Array<{ role: string; content: any }> {
  const result: Array<{ role: string; content: any }> = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === 'system') continue; // system 单独提取
    const content: any[] = [];

    // 文本内容
    if (msg.content) {
      content.push({ type: 'text', text: msg.content });
    }

    // 工具调用（assistant 消息）
    if (msg.role === 'assistant' && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        let args = {};
        try { args = JSON.parse(tc.function?.arguments || '{}'); } catch {}
        content.push({
          type: 'tool_use',
          id: tc.id || tc.function?.name || 'call_unknown',
          name: tc.function?.name || '',
          input: args,
        });
      }
    }

    // 工具结果（tool 消息）
    if (msg.role === 'tool') {
      result.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: msg.tool_call_id,
          content: msg.content,
        }],
      });
      continue;
    }

    result.push({ role: msg.role, content: content.length === 1 && content[0].type === 'text' ? content[0].text : content });
  }
  return result;
}

export async function anthropicStreamChat(
  apiKey: string,
  messages: any[],
  tools: Array<unknown>,
  modelConfig: { model: string; baseUrl: string },
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<StreamResult> {
  const { model, baseUrl } = modelConfig;

  // 提取 system 消息
  const systemMessages = messages.filter(m => m.role === 'system').map(m => m.content);
  const systemPrompt = systemMessages.length > 0 ? systemMessages.join('\n\n') : undefined;
  const anthropicMessages = buildAnthropicMessages(messages);

  // 转换工具格式：OpenAI -> Anthropic
  const anthropicTools = tools.map((t: any) => {
    const fn = t.function || t;
    return {
      name: fn.name,
      description: fn.description || '',
      input_schema: {
        type: 'object',
        properties: fn.parameters?.properties || {},
        required: fn.parameters?.required || [],
      },
    };
  });

  const bodyObj: any = {
    model,
    max_tokens: 8192,
    messages: anthropicMessages,
    stream: true,
  };
  if (systemPrompt) bodyObj.system = systemPrompt;
  if (anthropicTools.length > 0) bodyObj.tools = anthropicTools;

  const body = JSON.stringify(bodyObj);

  return new Promise((resolve, reject) => {
    const url = new URL('/v1/messages', baseUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Accept': 'text/event-stream',
      },
    };

    const result: StreamResult = { content: '', thinking: '', toolCalls: [] };
    const toolUseAccum = new Map<string, { name: string; arguments: string }>();
    let currentToolId: string | null = null;
    let contentBlockIndex = -1;

    const req = https.request(options, (res) => {
      const status = res.statusCode ?? 0;
      if (status < 200 || status >= 300) {
        let errBuf = '';
        res.setEncoding('utf-8');
        res.on('data', (c: string) => { errBuf += c; });
        res.on('end', () => {
          let detail = errBuf.trim();
          try {
            const parsed = JSON.parse(detail);
            detail = parsed.error?.message || detail;
          } catch {}
          reject(new Error(`Anthropic API ${status}: ${detail}`));
        });
        return;
      }

      let buffer = '';
      res.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data) continue;
          try {
            const event = JSON.parse(data);

            switch (event.type) {
              case 'message_start':
                if (event.message?.usage) {
                  result.usage = {
                    prompt_tokens: event.message.usage.input_tokens || 0,
                    completion_tokens: event.message.usage.output_tokens || 0,
                    total_tokens: (event.message.usage.input_tokens || 0) + (event.message.usage.output_tokens || 0),
                  };
                }
                break;

              case 'content_block_start': {
                const block = event.content_block;
                if (block?.type === 'tool_use') {
                  currentToolId = block.id;
                  contentBlockIndex++;
                  toolUseAccum.set(block.id, { name: block.name || '', arguments: '' });
                } else if (block?.type === 'thinking') {
                  // thinking block
                }
                break;
              }

              case 'content_block_delta': {
                const delta = event.delta;
                if (delta?.type === 'text_delta') {
                  result.content += delta.text;
                  callbacks.onContent(delta.text);
                } else if (delta?.type === 'thinking_delta') {
                  result.thinking += delta.thinking;
                  callbacks.onThinking(delta.thinking);
                } else if (delta?.type === 'input_json_delta') {
                  if (currentToolId) {
                    const existing = toolUseAccum.get(currentToolId);
                    if (existing) {
                      existing.arguments += delta.partial_json;
                    }
                  }
                }
                break;
              }

              case 'content_block_stop':
                currentToolId = null;
                break;

              case 'message_delta':
                if (event.delta?.stop_reason) {
                  result.finishReason = event.delta.stop_reason;
                }
                if (event.usage) {
                  result.usage = {
                    prompt_tokens: event.usage.input_tokens || result.usage?.prompt_tokens || 0,
                    completion_tokens: event.usage.output_tokens || result.usage?.completion_tokens || 0,
                    total_tokens: (event.usage.input_tokens || 0) + (event.usage.output_tokens || 0),
                  };
                }
                break;

              case 'message_stop':
                // 收集所有 tool_use
                for (const [id, tc] of toolUseAccum) {
                  result.toolCalls.push({ id, name: tc.name, arguments: tc.arguments || '{}' });
                }
                break;
            }
          } catch {}
        }
      });

      res.on('end', () => {
        // 处理剩余的 tool_use
        for (const [id, tc] of toolUseAccum) {
          if (!result.toolCalls.find(t => t.id === id)) {
            result.toolCalls.push({ id, name: tc.name, arguments: tc.arguments || '{}' });
          }
        }
        resolve(result);
      });

      res.on('error', reject);
    });

    req.on('error', (err) => {
      if (signal?.aborted) {
        resolve(result);
      } else {
        reject(err);
      }
    });

    if (signal) {
      signal.addEventListener('abort', () => req.destroy(), { once: true });
    }

    req.write(body);
    req.end();
  });
}
