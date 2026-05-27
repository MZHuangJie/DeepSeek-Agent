import { describe, it, expect } from 'vitest';
import { parseRoleplayResponse, formatRoleplayMessageForHistory, shouldRetryRoleplayStatus, parseMultiRoleplayResponse, shouldRetryMultiRoleplayStatus } from '../parseRoleplayResponse';

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

  it('strips stray closing reply tag when opening tag is missing', () => {
    const raw = `（手指刚按下拨号键的第一位数，屏幕的光映在她脸上。）

（缓缓转过身，眼神复杂地看着你。）

</reply>
<status>
{"情绪":"复杂"}
</status>`;
    const parsed = parseRoleplayResponse(raw);
    expect(parsed.reply).toContain('手指刚按下');
    expect(parsed.reply).not.toContain('</reply>');
    expect(parsed.reply).not.toContain('<reply');
  });
});

describe('parseMultiRoleplayResponse', () => {
  it('parses multiple turns with per-character status', () => {
    const raw = `<scene>
<turn character="林宛儿">
<reply>你好。</reply>
<status>{"情绪":"平静"}</status>
</turn>
<turn character="柳如烟">
<reply>有事？</reply>
<status>{"情绪":"冷淡"}</status>
</turn>
</scene>`;
    const parsed = parseMultiRoleplayResponse(raw);
    expect(parsed.turns).toHaveLength(2);
    expect(parsed.turns[0].character).toBe('林宛儿');
    expect(parsed.turns[1].reply).toContain('有事');
    expect(parsed.turns[1].status?.['情绪']).toBe('冷淡');
  });
});

describe('shouldRetryMultiRoleplayStatus', () => {
  it('retries when a turn is missing status', () => {
    const raw = `<scene><turn character="A"><reply>hi</reply></turn></scene>`;
    expect(shouldRetryMultiRoleplayStatus(raw, ['A'])).toBe(true);
  });
});

describe('shouldRetryRoleplayStatus', () => {
  it('retries when status block is missing', () => {
    expect(shouldRetryRoleplayStatus('<reply>只有正文</reply>', true)).toBe(true);
  });

  it('does not retry when status is complete', () => {
    const raw = `<reply>你好</reply><status>{"情绪":"平静"}</status>`;
    expect(shouldRetryRoleplayStatus(raw, true)).toBe(false);
  });

  it('does not retry when status fields are not configured', () => {
    expect(shouldRetryRoleplayStatus('<reply>只有正文</reply>', false)).toBe(false);
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
