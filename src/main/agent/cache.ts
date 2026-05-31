import crypto from 'crypto';

export interface CachePrefix {
  systemPrompt: string;
  projectContext: string;
}

let cachedPrefix: CachePrefix | null = null;
let lastHash = '';

function hash(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
}

export function buildCachePrefix(systemPrompt: string, projectContext: string): CachePrefix {
  const h = hash(systemPrompt + projectContext);
  if (h === lastHash && cachedPrefix) return cachedPrefix;
  cachedPrefix = { systemPrompt, projectContext };
  lastHash = h;
  return cachedPrefix;
}

/**
 * 构建发送给 LLM 的消息列表。
 *
 * **缓存友好设计（DeepSeek 前缀匹配缓存）**：
 * - systemPrompt 和 projectContext 合并为**一条** system 消息，确保前缀稳定
 * - 避免将可变内容作为独立 system 消息插入，打断前缀导致后续全部 cache miss
 * - DeepSeek 对已缓存的前缀 token 按原价 10% 计费
 */
export function buildMessages(
  prefix: CachePrefix,
  history: Array<{ role: string; content: string | any[] }>,
  newMessage: string | any[]
) {
  const systemContent = prefix.projectContext
    ? `${prefix.systemPrompt}\n\n---\n${prefix.projectContext}`
    : prefix.systemPrompt;

  const messages: Array<{ role: string; content: string | any[] }> = [
    { role: 'system', content: systemContent },
  ];
  messages.push(...history);
  messages.push({ role: 'user', content: newMessage });
  return messages;
}
