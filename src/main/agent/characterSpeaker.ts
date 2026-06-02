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
      content: `以下是群聊的讨论历史：\n${contextStr}\n\n请以你的角色身份参与这场协作讨论。你需要：\n1. 阅读之前的发言，回应或补充他人的观点\n2. 如果你的工作需要前置信息（如产品方向、设计稿），而它们还没有明确，**向用户提问**\n3. 完成你的专业输出后，**主动请求用户反馈**\n4. 只输出你的发言内容，不要带角色名前缀\n5. 使用 Markdown 格式让发言清晰易读`,
    });
  }

  messages.push({ role: 'user', content: `[系统] 轮到你了。用户说："${userMessage}"。请根据讨论上下文，给出你的专业意见。如果你需要更多信息才能继续，请直接向用户提问。如果你已经有了结论/方案/设计，请完整呈现并请用户确认。\n\n回复格式：使用 Markdown 格式组织回复，适当使用**加粗**、*斜体*、列表、代码块等。如果你使用 <reply> 标签，请在标签内部使用 Markdown。` });

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
