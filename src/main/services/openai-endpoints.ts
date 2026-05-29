/** 拼接 OpenAI 兼容 chat/completions 地址（避免 new URL('/path', base) 覆盖 base 路径） */
export function buildChatCompletionsUrl(baseUrl: string): URL {
  const base = baseUrl.replace(/\/+$/, '');
  const path = base.endsWith('/v1') ? '/chat/completions' : '/v1/chat/completions';
  return new URL(`${base}${path}`);
}
