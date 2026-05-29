import { describe, expect, it } from 'vitest';
import { buildChatCompletionsUrl } from '../openai-endpoints';

describe('buildChatCompletionsUrl', () => {
  it('preserves nested v1 base path', () => {
    const url = buildChatCompletionsUrl('https://dashscope.aliyuncs.com/compatible-mode/v1');
    expect(url.href).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
  });

  it('appends /v1/chat/completions for plain host base', () => {
    const url = buildChatCompletionsUrl('https://api.openai.com');
    expect(url.href).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('appends /chat/completions when base already ends with /v1', () => {
    const url = buildChatCompletionsUrl('https://api.anthropic.com/v1');
    expect(url.href).toBe('https://api.anthropic.com/v1/chat/completions');
  });
});
