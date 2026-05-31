export type RoleplayStatus = Record<string, unknown>;

export interface RoleplayTurn {
  character: string;
  reply: string;
  status?: RoleplayStatus;
  statusComplete: boolean;
}

export interface ParsedRoleplayResponse {
  reply: string;
  status?: RoleplayStatus;
  statusComplete: boolean;
}

export interface ParsedMultiRoleplayResponse {
  turns: RoleplayTurn[];
  displayText: string;
  isMulti: boolean;
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

  // 模型有时会漏写逗号，尝试自动补逗号再解析
  const withCommas = text.replace(/(\s*"[^"]+":\s*[^,\n]+)(\s*\n\s*")/g, '$1,$2');
  if (withCommas !== text) attempts.push(withCommas);

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

function stripReplyTags(text: string): string {
  return text.replace(/<\/?reply\s*>/gi, '').trim();
}

/** 去掉 reply 区块标签，供展示层兜底使用 */
export function stripRoleplayReplyTags(text: string): string {
  return stripReplyTags(text);
}

function extractReply(text: string): string {
  const paired = text.match(/<reply\s*>([\s\S]*?)<\/reply\s*>/i);
  if (paired) return paired[1].trim();

  const statusIdx = text.search(/<status\s*>/i);
  const beforeStatus = (statusIdx >= 0 ? text.slice(0, statusIdx) : text).trim();

  const openOnly = beforeStatus.match(/<reply\s*>([\s\S]*)$/i);
  if (openOnly) return openOnly[1].trim();

  // 模型漏写 <reply> 开头、只写了 </reply> 时，去掉残留标签
  return stripReplyTags(beforeStatus);
}

function extractStatus(text: string): { status?: RoleplayStatus; statusComplete: boolean } {
  const closed = text.match(/<status\s*>([\s\S]*?)<\/status\s*>/i);
  if (closed) {
    const status = tryParseStatusObject(closed[1]);
    if (status) return { status, statusComplete: true };
    return { statusComplete: false };
  }

  const openIdx = text.search(/<status\s*>/i);
  if (openIdx < 0) return { statusComplete: false };

  const tail = text.slice(openIdx).replace(/^<status\s*>/i, '');
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
  if (parsed.status && parsed.statusComplete) return false;
  // 已有较长正文时保留展示，避免因缺 status 触发整段重生成
  if (parsed.reply.trim().length >= 80) return false;
  return true;
}

/** 将已解析的助手消息还原为 XML 格式，供后续轮次上下文使用 */
export function formatRoleplayMessageForHistory(
  reply: string,
  status?: RoleplayStatus,
): string {
  if (!status || Object.keys(status).length === 0) return reply;
  return `<reply>\n${reply}\n</reply>\n\n<status>\n${JSON.stringify(status, null, 2)}\n</status>`;
}

function parseTurnBlock(character: string, inner: string): RoleplayTurn {
  const reply = extractReply(inner);
  const { status, statusComplete } = extractStatus(inner);
  return { character: character.trim(), reply, status, statusComplete };
}

export function parseMultiRoleplayResponse(raw: string): ParsedMultiRoleplayResponse {
  const text = raw ?? '';
  const turns: RoleplayTurn[] = [];
  const turnRegex = /<turn\s+character=["']([^"']+)["']\s*>([\s\S]*?)<\/turn\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = turnRegex.exec(text)) !== null) {
    turns.push(parseTurnBlock(match[1], match[2]));
  }

  if (turns.length === 0 && /<scene\s*>/i.test(text)) {
    const sceneMatch = text.match(/<scene\s*>([\s\S]*?)<\/scene\s*>/i);
    const inner = sceneMatch?.[1] ?? text;
    const looseRegex = /<turn\s+character=["']([^"']+)["']\s*>([\s\S]*?)(?=<turn\s+character=|<\/scene\s*>|$)/gi;
    while ((match = looseRegex.exec(inner)) !== null) {
      turns.push(parseTurnBlock(match[1], match[2]));
    }
  }

  const displayText = turns.length > 0
    ? turns.map(t => `【${t.character}】\n${t.reply}`.trim()).filter(Boolean).join('\n\n')
    : parseRoleplayResponse(text).reply;

  return {
    turns,
    displayText,
    isMulti: turns.length > 0 || /<scene\s*>/i.test(text) || /<turn\s+character=/i.test(text),
  };
}

export function formatMultiRoleplayMessageForHistory(turns: RoleplayTurn[]): string {
  if (turns.length === 0) return '';
  const body = turns.map(turn => {
    const statusJson = turn.status && Object.keys(turn.status).length > 0
      ? JSON.stringify(turn.status, null, 2)
      : '{}';
    return [
      `<turn character="${turn.character}">`,
      '<reply>',
      turn.reply,
      '</reply>',
      '',
      '<status>',
      statusJson,
      '</status>',
      '</turn>',
    ].join('\n');
  }).join('\n\n');
  return `<scene>\n${body}\n</scene>`;
}

export function shouldRetryMultiRoleplayStatus(
  raw: string,
  npcNames: string[],
): boolean {
  if (!raw?.trim() || npcNames.length === 0) return false;
  const parsed = parseMultiRoleplayResponse(raw);
  if (parsed.turns.length === 0) return true;
  const missingStatus = parsed.turns.some(turn => !(turn.status && turn.statusComplete));
  if (!missingStatus) return false;
  // 各 turn 已有实质台词时保留展示，避免因缺 status 触发整段重生成
  const substantial = parsed.turns.every(turn => turn.reply.trim().length >= 20);
  if (substantial) return false;
  return true;
}

export function isMultiRoleplayRaw(raw: string): boolean {
  return parseMultiRoleplayResponse(raw).isMulti;
}
