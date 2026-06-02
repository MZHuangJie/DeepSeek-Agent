// src/main/agent/characterSpeaker.ts
import { buildChatCompletionsUrl } from '../services/openai-endpoints';
import https from 'https';

const httpsAgent = new https.Agent({ keepAlive: false });

export async function streamCharacterReply(
  systemPrompt: string,
  context: Array<{ speaker: string; content: string }>,
  userMessage: string,
  modelConfig: { model: string; baseUrl: string; apiKey: string },
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const url = buildChatCompletionsUrl(modelConfig.baseUrl);

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
  ];

  const contextStr = context.map(c => `[${c.speaker}]: ${c.content}`).join('\n');
  if (contextStr) {
    messages.push({
      role: 'system',
      content: `以下是群聊的最近对话历史：\n${contextStr}\n\n请基于以上对话历史，以你的角色身份回复。只输出你的发言内容，不要带角色名前缀。可以使用 Markdown 格式。`,
    });
  }

  messages.push({ role: 'user', content: `[系统] 轮到你发言了。用户刚说："${userMessage}"。请以你的角色身份给出回复。\n\n回复格式要求：请使用 Markdown 格式组织你的回复。适当使用**加粗**、*斜体*、- 列表、> 引用、\`\`\`代码块\`\`\` 等格式来让回复更清晰易读。如果你使用 <reply> 标签，请在标签内部使用 Markdown。` });

  const bodyObj: Record<string, unknown> = {
    model: modelConfig.model,
    messages,
    stream: true,
    stream_options: { include_usage: true },
  };

  const body = JSON.stringify(bodyObj);

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${modelConfig.apiKey}`,
        'Accept': 'text/event-stream',
      },
      agent: httpsAgent,
      signal,
    }, (res) => {
      if (res.statusCode !== 200) {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => reject(new Error(`角色 API 返回 ${res.statusCode}: ${data.slice(0, 200)}`)));
        return;
      }

      let fullContent = '';

      res.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        const lines = text.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              onChunk(delta);
            }
          } catch { /* skip unparseable lines */ }
        }
      });

      res.on('end', () => resolve(fullContent));
      res.on('error', reject);
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
