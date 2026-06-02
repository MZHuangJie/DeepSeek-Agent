import { describe, it, expect } from 'vitest';
import { normalizeStatusFields, type StatusFieldDef } from '../roleplay';

describe('normalizeStatusFields', () => {
  it('returns empty array for empty input', () => {
    expect(normalizeStatusFields([])).toEqual([]);
  });

  it('deduplicates labels by appending suffix to key', () => {
    const fields: StatusFieldDef[] = [
      { key: 'a', label: '好感度', type: 'number', section: 'state' },
      { key: 'b', label: '好感度', type: 'number', section: 'state' },
    ];
    const result = normalizeStatusFields(fields);
    expect(result).toHaveLength(2);
    expect(result[0].key).toBe('好感度');
    expect(result[1].key).toBe('好感度_2');
  });

  it('assigns defaults to missing type and section', () => {
    // @ts-ignore
    const result = normalizeStatusFields([{ key: 'a', label: 'Test' }]);
    expect(result[0].type).toBe('text');
    expect(result[0].section).toBe('state');
    expect(result[0].enabled).toBe(true);
  });

  it('uses label as key', () => {
    const fields: StatusFieldDef[] = [
      { key: 'old_key', label: '生命值', type: 'number', section: 'state' },
    ];
    const result = normalizeStatusFields(fields);
    expect(result[0].key).toBe('生命值');
  });

  it('uses key as label fallback when label is empty', () => {
    const fields = [
      { key: 'fallback_key', label: '', type: 'text' as const, section: 'state' as const },
    ];
    const result = normalizeStatusFields(fields);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('fallback_key');
  });

  it('preserves promptHint when provided', () => {
    const fields: StatusFieldDef[] = [
      { key: 'hp', label: '生命值', type: 'number', section: 'state', promptHint: '当前血量' },
    ];
    const result = normalizeStatusFields(fields);
    expect(result[0].promptHint).toBe('当前血量');
  });
});
