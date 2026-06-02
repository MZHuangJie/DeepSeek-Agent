import { describe, it, expect } from 'vitest';
import { sanitizeSessionTitle, deriveFallbackSessionTitle } from '../sessionTitle';

describe('sanitizeSessionTitle', () => {
  it('trims whitespace and quotes', () => {
    expect(sanitizeSessionTitle('  "你好世界"  ')).toBe('你好世界');
  });

  it('removes 标题: prefix', () => {
    expect(sanitizeSessionTitle('标题：Python 代码优化')).toBe('Python 代码优化');
  });

  it('truncates to 32 characters', () => {
    const long = '这是一个非常长的标题用来测试截断功能效果怎么样呢';
    const result = sanitizeSessionTitle(long);
    expect(result.length).toBeLessThanOrEqual(32);
  });

  it('returns empty string for instruction echo', () => {
    expect(sanitizeSessionTitle('我们被要求输出标题')).toBe('');
    expect(sanitizeSessionTitle('会话标题生成测试')).toBe('');
    expect(sanitizeSessionTitle('只输出标题不要引号')).toBe('');
  });

  it('cleans CJK brackets', () => {
    expect(sanitizeSessionTitle('「数据库优化」')).toBe('数据库优化');
  });
});

describe('deriveFallbackSessionTitle', () => {
  it('uses first sentence as title', () => {
    const title = deriveFallbackSessionTitle('请帮我优化这段代码。性能太差了。');
    expect(title).toContain('请帮我优化这段代码');
  });

  it('replaces image markdown with placeholder', () => {
    const title = deriveFallbackSessionTitle('![image](path/to/img.png) 这是什么图');
    expect(title).toContain('[图片]');
    expect(title).not.toContain('path/to/img.png');
  });

  it('returns "图片对话" for image-only input', () => {
    expect(deriveFallbackSessionTitle('![image](img.png)')).toBe('图片对话');
    expect(deriveFallbackSessionTitle('（图片）')).toBe('图片对话');
  });

  it('strips slash command prefix', () => {
    const title = deriveFallbackSessionTitle('/code 帮我写一个排序函数');
    expect(title).not.toContain('/code');
    expect(title).toContain('帮我写一个排序函数');
  });

  it('truncates long titles', () => {
    const long = '这是一个非常长的标题用来测试截断功能';
    const title = deriveFallbackSessionTitle(long);
    expect(title.length).toBeLessThanOrEqual(32);
  });

  it('handles empty input', () => {
    expect(deriveFallbackSessionTitle('')).toBe('图片对话');
  });
});
