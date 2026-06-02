import { describe, it, expect } from 'vitest';
import path from 'path';
import {
  resolveImageModelConfig,
  buildPortraitImageArgs,
  DEFAULT_PORTRAIT_IMAGE_SIZE,
} from '../image-model-config';
import { buildImageGenerationUrl, parseImageGenerationResponse } from '../imageGen';
import { buildCharacterDescription } from '../roleplay-portrait';
import { getPortraitFilePath, isAgentImagesPath } from '../agent-images';

const CHAT_IMAGE_SETTINGS = JSON.stringify({
  enabled: true,
  baseUrl: 'https://relay.example.com/v1',
  model: 'gpt-image-1',
  apiKey: '',
});

describe('resolveImageModelConfig', () => {
  it('returns undefined when image model is disabled (chat also skips generate_image)', () => {
    const raw = JSON.stringify({
      enabled: false,
      baseUrl: 'https://relay.example.com',
      model: 'gpt-image-1',
      apiKey: 'sk-img',
    });
    expect(resolveImageModelConfig(raw, 'sk-global')).toBeUndefined();
  });

  it('falls back to global api key when image model key is empty', () => {
    const cfg = resolveImageModelConfig(CHAT_IMAGE_SETTINGS, 'sk-global');
    expect(cfg).toEqual({
      baseUrl: 'https://relay.example.com/v1',
      model: 'gpt-image-1',
      apiKey: 'sk-global',
      apiType: 'images',
      extraParams: undefined,
      promptInstruction: undefined,
    });
  });

  it('prefers dedicated image model api key', () => {
    const raw = JSON.stringify({
      enabled: true,
      baseUrl: 'https://relay.example.com',
      model: 'dall-e-3',
      apiKey: 'sk-image-only',
    });
    const cfg = resolveImageModelConfig(raw, 'sk-global');
    expect(cfg?.apiKey).toBe('sk-image-only');
    expect(cfg?.model).toBe('dall-e-3');
  });
});

describe('portrait vs chat image request parity', () => {
  it('uses the same default square size as chat generate_image (not 1024x1792)', () => {
    const args = buildPortraitImageArgs('anime girl portrait');
    expect(args.size).toBe('1024x1024');
    expect(args.size).toBe(DEFAULT_PORTRAIT_IMAGE_SIZE);
    expect(args.size).not.toBe('1024x1792');
  });

  it('builds the same relay URL whether baseUrl includes /v1 or not', () => {
    expect(buildImageGenerationUrl('https://relay.example.com')).toBe(
      'https://relay.example.com/v1/images/generations',
    );
    expect(buildImageGenerationUrl('https://relay.example.com/v1')).toBe(
      'https://relay.example.com/v1/images/generations',
    );
  });

  it('portrait path resolves the same image model config as chat when settings match', () => {
    const chatCfg = resolveImageModelConfig(CHAT_IMAGE_SETTINGS, 'sk-global');
    const portraitCfg = resolveImageModelConfig(CHAT_IMAGE_SETTINGS, 'sk-global');
    expect(portraitCfg).toEqual(chatCfg);
  });
});

describe('buildCharacterDescription', () => {
  it('includes key fields for prompt generation', () => {
    const text = buildCharacterDescription({
      name: '艾拉',
      gender: '女',
      occupation: '咖啡师',
      personality: '温柔',
      background: '旧城巷弄',
      body: { hair: '深棕长发', eyes: '琥珀色' },
    });
    expect(text).toContain('艾拉');
    expect(text).toContain('咖啡师');
    expect(text).toContain('深棕长发');
  });
});

describe('regression: old portrait fallback would hit chat model host', () => {
  it('does not silently fall back to deepseek chat baseUrl for image generation', () => {
    const cfg = resolveImageModelConfig(null, 'sk-global');
    expect(cfg).toBeUndefined();
    // 旧逻辑会把 baseUrl 设成 https://api.deepseek.com 并请求 gpt-image-1，导致长时间挂起
  });
});

describe('parseImageGenerationResponse', () => {
  it('parses OpenAI url response', () => {
    const result = parseImageGenerationResponse({
      data: [{ url: 'https://cdn.example.com/a.png', revised_prompt: 'rev' }],
    });
    expect(result.urls).toEqual(['https://cdn.example.com/a.png']);
    expect(result.revisedPrompt).toBe('rev');
  });

  it('parses b64_json and relay image_url fields', () => {
    const result = parseImageGenerationResponse({
      data: [{ b64_json: 'abc123' }],
    });
    expect(result.urls[0]).toBe('data:image/png;base64,abc123');

    const relay = parseImageGenerationResponse({
      images: [{ image_url: 'https://relay.example.com/out.png' }],
    });
    expect(relay.urls[0]).toBe('https://relay.example.com/out.png');
  });

  it('throws when response has no image payload', () => {
    expect(() => parseImageGenerationResponse({ task_id: '123' })).toThrow('未返回图片');
  });
});

describe('portrait storage in project .deepseek-agent-images', () => {
  const projectDir = 'D:/MyCLI';

  it('stores portrait files under project agent images dir', () => {
    const file = getPortraitFilePath(projectDir, 'char-1');
    expect(file).toContain('.deepseek-agent-images');
    expect(file).toContain('portrait-char-1.png');
    expect(isAgentImagesPath(file, projectDir)).toBe(true);
  });
});