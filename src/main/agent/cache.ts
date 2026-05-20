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

export function buildMessages(
  prefix: CachePrefix,
  history: Array<{ role: string; content: string }>,
  newMessage: string
) {
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: prefix.systemPrompt },
  ];
  if (prefix.projectContext) {
    messages.push({ role: 'system', content: prefix.projectContext });
  }
  messages.push(...history);
  messages.push({ role: 'user', content: newMessage });
  return messages;
}
