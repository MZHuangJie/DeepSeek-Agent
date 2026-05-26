import { describe, it, expect } from 'vitest';
import { parseRoleplayResponse, formatRoleplayMessageForHistory } from '../parseRoleplayResponse';

describe('parseRoleplayResponse', () => {
  it('parses reply and status json', () => {
    const raw = `<reply>
*她别过脸去* 你……别说了。
</reply>

<status>
{
  "clothing": ["黑色宽松针织毛衣", "深色居家短裤"],
  "mood": "害羞、压抑、内心挣扎",
  "heartRate": 101,
  "trust": "+2 (当前: 28/100)",
  "monologue": "为什么……每次说到这些……"
}
</status>`;

    const parsed = parseRoleplayResponse(raw);
    expect(parsed.reply).toContain('别过脸');
    expect(parsed.statusComplete).toBe(true);
    expect(parsed.status?.heartRate).toBe(101);
    expect(parsed.status?.clothing).toEqual(['黑色宽松针织毛衣', '深色居家短裤']);
  });

  it('streams partial reply before status closes', () => {
    const partial = `<reply>你好</reply>\n<status>\n{"mood":"平静"`;
    const parsed = parseRoleplayResponse(partial);
    expect(parsed.reply).toBe('你好');
    expect(parsed.statusComplete).toBe(false);
  });

  it('parses unclosed status block with valid json object', () => {
    const raw = `<reply>第二句</reply>\n<status>\n{"情绪":"紧张","心率":115}`;
    const parsed = parseRoleplayResponse(raw);
    expect(parsed.reply).toBe('第二句');
    expect(parsed.statusComplete).toBe(true);
    expect(parsed.status?.['情绪']).toBe('紧张');
  });

  it('parses json inside markdown fence', () => {
    const raw = `<reply>嗯</reply><status>\n\`\`\`json\n{"服装":["短裙"]}\n\`\`\`\n</status>`;
    const parsed = parseRoleplayResponse(raw);
    expect(parsed.statusComplete).toBe(true);
    expect(parsed.status?.['服装']).toEqual(['短裙']);
  });

  it('falls back to plain text without tags', () => {
    const parsed = parseRoleplayResponse('普通回复');
    expect(parsed.reply).toBe('普通回复');
    expect(parsed.statusComplete).toBe(false);
  });
});

describe('formatRoleplayMessageForHistory', () => {
  it('reconstructs xml for assistant history', () => {
    const formatted = formatRoleplayMessageForHistory('你好', { 情绪: '平静' });
    expect(formatted).toContain('<reply>');
    expect(formatted).toContain('<status>');
    expect(formatted).toContain('"情绪"');
    expect(parseRoleplayResponse(formatted).status?.['情绪']).toBe('平静');
  });
});
