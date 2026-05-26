export type RoleplayStatus = Record<string, unknown>;

export interface ParsedRoleplayResponse {
  reply: string;
  status?: RoleplayStatus;
  statusComplete: boolean;
}

function stripCodeFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? text).trim();
}

function tryParseStatusObject(rawJson: string): RoleplayStatus | null {
  const text = stripCodeFence(rawJson.trim());
  if (!text) return null;

  const attempts = [text];
  if (!text.endsWith('}')) {
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) attempts.push(objMatch[0]);
  }

  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as RoleplayStatus;
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

function extractReply(text: string): string {
  const hasReplyTag = /<reply>/i.test(text);
  if (hasReplyTag) {
    const openIdx = text.search(/<reply>/i);
    const closeMatch = text.slice(openIdx).match(/<reply>([\s\S]*?)<\/reply>/i);
    if (closeMatch) return closeMatch[1].trim();
    return text.slice(openIdx).replace(/^<reply>/i, '').replace(/<status>[\s\S]*$/i, '').trim();
  }
  const statusIdx = text.search(/<status>/i);
  return (statusIdx >= 0 ? text.slice(0, statusIdx) : text).trim();
}

function extractStatus(text: string): { status?: RoleplayStatus; statusComplete: boolean } {
  const closed = text.match(/<status>([\s\S]*?)<\/status>/i);
  if (closed) {
    const status = tryParseStatusObject(closed[1]);
    if (status) return { status, statusComplete: true };
    return { statusComplete: false };
  }

  const openIdx = text.search(/<status>/i);
  if (openIdx < 0) return { statusComplete: false };

  const tail = text.slice(openIdx).replace(/^<status>/i, '');
  const status = tryParseStatusObject(tail);
  if (status) return { status, statusComplete: true };
  return { statusComplete: false };
}

/** 从模型原始输出中分离对话正文与状态 JSON */
export function parseRoleplayResponse(raw: string): ParsedRoleplayResponse {
  const text = raw ?? '';
  const reply = extractReply(text);
  const { status, statusComplete } = extractStatus(text);
  return { reply, status, statusComplete };
}

/** 配置了状态字段时，判断是否需要因缺失/无效 status 而重试 */
export function shouldRetryRoleplayStatus(raw: string, expectsStatus: boolean): boolean {
  if (!expectsStatus || !raw?.trim()) return false;
  const parsed = parseRoleplayResponse(raw);
  return !(parsed.status && parsed.statusComplete);
}

/** 将已解析的助手消息还原为 XML 格式，供后续轮次上下文使用 */
export function formatRoleplayMessageForHistory(
  reply: string,
  status?: RoleplayStatus,
): string {
  if (!status || Object.keys(status).length === 0) return reply;
  return `<reply>\n${reply}\n</reply>\n\n<status>\n${JSON.stringify(status, null, 2)}\n</status>`;
}
