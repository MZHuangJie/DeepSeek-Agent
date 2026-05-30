import { completeChat, ModelConfig } from '../agent/client';

const INVALID_TITLE_PATTERNS = [
  /我们被要求/i,
  /会话标题/i,
  /标题生成/i,
  /8[-~]18字/i,
  /概括用户核心诉求/i,
  /只输出标题/i,
  /不要引号/i,
  /根据对话内容/i,
  /^用户[:：]/i,
  /^助手[:：]/i,
];

function looksLikeInstructionEcho(raw: string): boolean {
  return INVALID_TITLE_PATTERNS.some(p => p.test(raw));
}

export function sanitizeSessionTitle(raw: string): string {
  let text = raw
    .replace(/^[\s"'「『【]+|[\s"'」』】]+$/g, '')
    .replace(/^标题[:：]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 32);

  // 如果清理后看起来像指令复述，视为无效
  if (looksLikeInstructionEcho(text)) return '';

  return text;
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
          '你是对话标题助手。阅读下面用户和助手的对话，生成一个8-18字的中文标题，概括用户核心诉求。\n\n规则：\n1. 直接输出标题文本，不要加任何前缀、解释或引号\n2. 不要复述本指令内容\n3. 不要输出 markdown',
      },
      { role: 'user', content: prompt },
    ],
    { ...modelConfig, model: titleModel },
    { maxTokens: 40, temperature: 0.2 },
  );

  const sanitized = sanitizeSessionTitle(content);
  // 如果模型返回了指令复述或空内容，回退到 fallback
  if (!sanitized) {
    return deriveFallbackSessionTitle(userMessage);
  }
  return sanitized;
}
