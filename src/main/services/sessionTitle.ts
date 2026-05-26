import { completeChat, ModelConfig } from '../agent/client';

export function sanitizeSessionTitle(raw: string): string {
  return raw
    .replace(/^[\s"'「『【]+|[\s"'」』】]+$/g, '')
    .replace(/^标题[:：]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 32);
}

export function deriveFallbackSessionTitle(raw: string): string {
  let text = raw
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '[图片]')
    .replace(/^\/[\w-]+\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text || text === '（图片）' || text === '[图片]') return '图片对话';

  const sentence = text.match(/^[^。！？.!?\n]{1,60}/)?.[0]?.trim() ?? text;
  const cleaned = sentence.replace(/[。！？.!?…]+$/g, '').trim();
  const title = cleaned || text;
  return title.length > 28 ? `${title.slice(0, 28)}…` : title;
}

export async function generateSessionTitle(
  apiKey: string,
  modelConfig: ModelConfig,
  userMessage: string,
  assistantPreview?: string,
): Promise<string> {
  const user = userMessage.trim().slice(0, 600);
  const assistant = assistantPreview?.trim().slice(0, 400);
  const prompt = assistant
    ? `用户：${user}\n\n助手：${assistant}`
    : `用户：${user}`;

  const titleModel = /reasoner|r1|thinking/i.test(modelConfig.model)
    ? 'deepseek-chat'
    : modelConfig.model;

  const content = await completeChat(
    apiKey,
    [
      {
        role: 'system',
        content:
          '你是会话标题生成器。根据对话内容输出一句简短中文标题（8-18字），概括用户核心诉求。只输出标题本身，不要引号、句号或 markdown。',
      },
      { role: 'user', content: prompt },
    ],
    { ...modelConfig, model: titleModel },
    { maxTokens: 40, temperature: 0.2 },
  );

  const sanitized = sanitizeSessionTitle(content);
  return sanitized || deriveFallbackSessionTitle(userMessage);
}
