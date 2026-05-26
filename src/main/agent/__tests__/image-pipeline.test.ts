import { describe, it, expect } from 'vitest';
import { extractImagePaths } from '../image-preprocess';
import { resolveVisionConfig } from '../vision-config';
import { extractOpenAIMessageText } from '../../services/vision';

describe('extractImagePaths', () => {
  it('should extract markdown image paths', () => {
    const text = '请看\n![image](D:\\proj\\.mycli\\clipboard\\paste-1.png)';
    expect(extractImagePaths(text)).toEqual(['D:\\proj\\.mycli\\clipboard\\paste-1.png']);
  });

  it('should extract @ image references', () => {
    const text = '@D:\\proj\\photo.jpg 这是什么';
    expect(extractImagePaths(text)).toEqual(['D:\\proj\\photo.jpg']);
  });
});

describe('resolveVisionConfig', () => {
  const modelConfig = { model: 'deepseek-chat', baseUrl: 'https://api.deepseek.com' };

  it('should require dedicated api key when vision host differs from chat', () => {
    const raw = JSON.stringify({
      enabled: true,
      baseUrl: 'https://api.openai.com',
      model: 'gpt-4o',
      apiKey: '',
      useActiveModel: true,
    });
    const cfg = resolveVisionConfig(modelConfig, 'global-key', {
      providerMultimodal: false,
      visionRaw: raw,
    });
    expect(cfg).toBeUndefined();
  });

  it('should use dedicated vision key when host differs', () => {
    const raw = JSON.stringify({
      enabled: true,
      baseUrl: 'https://api.openai.com',
      model: 'gpt-4o',
      apiKey: 'sk-vision',
      useActiveModel: true,
    });
    const cfg = resolveVisionConfig(modelConfig, 'global-key', {
      providerMultimodal: false,
      visionRaw: raw,
    });
    expect(cfg?.model).toBe('gpt-4o');
    expect(cfg?.apiKey).toBe('sk-vision');
  });

  it('should reuse chat api key when vision host matches chat host', () => {
    const raw = JSON.stringify({
      enabled: true,
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      apiKey: '',
      useActiveModel: false,
    });
    const cfg = resolveVisionConfig(modelConfig, 'global-key', {
      providerMultimodal: false,
      visionRaw: raw,
    });
    expect(cfg?.apiKey).toBe('global-key');
  });

  it('should use active model when multimodal and useActiveModel', () => {
    const raw = JSON.stringify({
      enabled: true,
      baseUrl: 'https://api.openai.com',
      model: 'gpt-4o',
      apiKey: '',
      useActiveModel: true,
    });
    const cfg = resolveVisionConfig(
      { model: 'gpt-4o', baseUrl: 'https://api.openai.com' },
      'global-key',
      { providerMultimodal: true, visionRaw: raw },
    );
    expect(cfg?.model).toBe('gpt-4o');
    expect(cfg?.baseUrl).toBe('https://api.openai.com');
    expect(cfg?.apiKey).toBe('global-key');
  });
});

describe('extractOpenAIMessageText', () => {
  it('should extract string content', () => {
    const text = extractOpenAIMessageText({
      choices: [{ message: { content: '这是一张截图' } }],
    });
    expect(text).toBe('这是一张截图');
  });

  it('should extract array content parts', () => {
    const text = extractOpenAIMessageText({
      choices: [{ message: { content: [{ type: 'text', text: '数组格式描述' }] } }],
    });
    expect(text).toBe('数组格式描述');
  });

  it('should fallback to reasoning_content', () => {
    const text = extractOpenAIMessageText({
      choices: [{ message: { content: null, reasoning_content: '推理字段里的描述内容' } }],
    });
    expect(text).toBe('推理字段里的描述内容');
  });
});
