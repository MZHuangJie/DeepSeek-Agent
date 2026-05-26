import { describe, it, expect } from 'vitest';
import { extractImagePaths } from '../image-preprocess';
import { resolveVisionConfig } from '../vision-config';

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

  it('should force dedicated vision when provider is not multimodal', () => {
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
    expect(cfg?.model).toBe('gpt-4o');
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
