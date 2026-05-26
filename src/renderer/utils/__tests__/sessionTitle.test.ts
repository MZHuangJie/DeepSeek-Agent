import { describe, expect, it } from 'vitest';
import { deriveFallbackSessionTitle, extractPlainUserText } from '../sessionTitle';

describe('sessionTitle utils', () => {
  it('extracts plain text from content parts', () => {
    expect(extractPlainUserText({
      content: '',
      contentParts: [
        { type: 'text', text: '请描述这张图片' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } },
      ],
    })).toBe('请描述这张图片');
  });

  it('derives a short fallback title from first sentence', () => {
    expect(deriveFallbackSessionTitle('帮我分析项目架构，并给出改进建议。另外再看看测试覆盖率。'))
      .toBe('帮我分析项目架构，并给出改进建议');
  });

  it('handles image-only messages', () => {
    expect(deriveFallbackSessionTitle('![image](D:/tmp/a.png)')).toBe('图片对话');
  });

  it('strips slash commands prefix', () => {
    expect(deriveFallbackSessionTitle('/review 检查 src/main 目录的安全问题'))
      .toBe('检查 src/main 目录的安全问题');
  });
});
