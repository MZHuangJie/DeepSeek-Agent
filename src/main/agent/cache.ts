export interface CachePrefix {
  systemPrompt: string;
  projectContext: string;
}

let cachedPrefix: CachePrefix | null = null;
let lastHash = '';

function hash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return h.toString(36);
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
