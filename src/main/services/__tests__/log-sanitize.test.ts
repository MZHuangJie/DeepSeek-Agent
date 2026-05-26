import { describe, it, expect } from 'vitest';
import {
  maskSecret,
  truncateText,
  summarizeUrl,
  summarizeJsonForLog,
} from '../log-sanitize';

describe('log-sanitize', () => {
  it('masks api keys', () => {
    expect(maskSecret('sk-abcdefghijklmnop')).toBe('sk-***mnop');
    expect(maskSecret('')).toBe('(empty)');
  });

  it('truncates long text', () => {
    const long = 'a'.repeat(600);
    expect(truncateText(long, 500)).toContain('(+100 chars)');
  });

  it('summarizes data urls', () => {
    expect(summarizeUrl('data:image/png;base64,abc123')).toBe('data:image/png;base64,[6 chars]');
  });

  it('redacts base64 in json logs', () => {
    const raw = JSON.stringify({ data: [{ b64_json: 'x'.repeat(300) }] });
    const summary = summarizeJsonForLog(raw);
    expect(summary).toContain('[300 chars]');
    expect(summary).not.toContain('x'.repeat(300));
  });
});
