/** 日志脱敏与摘要工具（避免写入 API Key / 大段 base64） */

export function maskSecret(value?: string | null): string {
  if (!value?.trim()) return '(empty)';
  const v = value.trim();
  if (v.length <= 8) return '***';
  return `${v.slice(0, 3)}***${v.slice(-4)}`;
}

export function truncateText(text: string, max = 500): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…(+${text.length - max} chars)`;
}

export function summarizeUrl(url: string): string {
  if (url.startsWith('data:')) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (match) return `data:${match[1]};base64,[${match[2].length} chars]`;
    return 'data:[invalid]';
  }
  try {
    const u = new URL(url);
    const q = u.search ? '?…' : '';
    return `${u.origin}${u.pathname}${q}`;
  } catch {
    return truncateText(url, 160);
  }
}

export function summarizeUrls(urls: string[]): string[] {
  return urls.map(summarizeUrl);
}

/** 将 JSON 响应体转为可写日志的摘要（替换 base64 字段） */
export function summarizeJsonForLog(raw: string, maxLen = 1200): string {
  const trimmed = raw.trim();
  if (!trimmed) return '(empty body)';
  try {
    const parsed = JSON.parse(trimmed);
    return truncateText(JSON.stringify(redactLargeFields(parsed)), maxLen);
  } catch {
    return truncateText(trimmed, maxLen);
  }
}

function redactLargeFields(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[depth-limit]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (value.startsWith('data:') && value.includes('base64,')) {
      const m = value.match(/^data:([^;]+);base64,(.+)$/);
      return m ? `data:${m[1]};base64,[${m[2].length} chars]` : 'data:[redacted]';
    }
    if (value.length > 200 && /^[A-Za-z0-9+/=\r\n]+$/.test(value.slice(0, 200))) {
      return `[base64 ${value.length} chars]`;
    }
    return value.length > 500 ? truncateText(value, 500) : value;
  }
  if (Array.isArray(value)) {
    return value.map(v => redactLargeFields(v, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/b64|base64|image/i.test(k) && typeof v === 'string' && v.length > 200) {
        out[k] = `[${v.length} chars]`;
      } else {
        out[k] = redactLargeFields(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}
