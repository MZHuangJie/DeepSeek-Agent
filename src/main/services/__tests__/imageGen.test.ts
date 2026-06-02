import { describe, it, expect } from 'vitest';
import { parseImageGenerationResponse, buildImageGenerationUrl } from '../imageGen';

describe('buildImageGenerationUrl', () => {
  it('appends /v1/images/generations to base URL without trailing slash', () => {
    expect(buildImageGenerationUrl('https://api.openai.com')).toBe('https://api.openai.com/v1/images/generations');
  });

  it('handles base URL with trailing slash', () => {
    expect(buildImageGenerationUrl('https://api.openai.com/')).toBe('https://api.openai.com/v1/images/generations');
  });

  it('handles base URL that already includes /v1', () => {
    expect(buildImageGenerationUrl('https://api.openai.com/v1')).toBe('https://api.openai.com/v1/images/generations');
  });
});

describe('parseImageGenerationResponse', () => {
  it('parses OpenAI url response', () => {
    const res = parseImageGenerationResponse({ data: [{ url: 'https://cdn.openai.com/img.png' }] });
    expect(res.urls).toEqual(['https://cdn.openai.com/img.png']);
    expect(res.revisedPrompt).toBeUndefined();
  });

  it('parses b64_json response', () => {
    const res = parseImageGenerationResponse({ data: [{ b64_json: 'aGVsbG8=' }] });
    expect(res.urls).toEqual(['data:image/png;base64,aGVsbG8=']);
  });

  it('parses revised_prompt from data array', () => {
    const res = parseImageGenerationResponse({
      data: [{ url: 'https://cdn.openai.com/img.png', revised_prompt: 'A beautiful sunset' }],
    });
    expect(res.urls).toEqual(['https://cdn.openai.com/img.png']);
    expect(res.revisedPrompt).toBe('A beautiful sunset');
  });

  it('parses relay proxy format with images array', () => {
    const res = parseImageGenerationResponse({
      images: [{ image_url: 'https://relay.example.com/img.png' }],
    });
    expect(res.urls).toEqual(['https://relay.example.com/img.png']);
  });

  it('parses relay proxy format with data.image_url', () => {
    const res = parseImageGenerationResponse({
      data: [{ image_url: 'https://relay.example.com/img.png' }],
    });
    expect(res.urls).toEqual(['https://relay.example.com/img.png']);
  });

  it('parses Gemini native response with candidates', () => {
    const res = parseImageGenerationResponse({
      candidates: [{
        content: {
          parts: [{ inlineData: { mimeType: 'image/png', data: 'aGVsbG8=' } }],
        },
      }],
    });
    expect(res.urls).toEqual(['data:image/png;base64,aGVsbG8=']);
  });

  it('parses Gemini native response with default mime type', () => {
    const res = parseImageGenerationResponse({
      candidates: [{
        content: {
          parts: [{ inlineData: { data: 'aGVsbG8=' } }],
        },
      }],
    });
    expect(res.urls).toEqual(['data:image/png;base64,aGVsbG8=']);
  });

  it('parses chat completions response with base64 in message content', () => {
    const res = parseImageGenerationResponse({
      choices: [{
        message: { content: 'data:image/png;base64,aGVsbG8=' },
      }],
    });
    expect(res.urls).toEqual(['data:image/png;base64,aGVsbG8=']);
  });

  it('parses chat completions response with content array containing inlineData', () => {
    const res = parseImageGenerationResponse({
      choices: [{
        message: {
          content: [{ inlineData: { mimeType: 'image/jpeg', data: 'aGVsbG8=' } }],
        },
      }],
    });
    expect(res.urls).toEqual(['data:image/jpeg;base64,aGVsbG8=']);
  });

  it('parses flat url at root level', () => {
    const res = parseImageGenerationResponse({ url: 'https://cdn.example.com/img.png' });
    expect(res.urls).toEqual(['https://cdn.example.com/img.png']);
  });

  it('parses flat image_url at root level', () => {
    const res = parseImageGenerationResponse({ image_url: 'https://cdn.example.com/img.png' });
    expect(res.urls).toEqual(['https://cdn.example.com/img.png']);
  });

  it('parses flat b64_json at root level', () => {
    const res = parseImageGenerationResponse({ b64_json: 'aGVsbG8=' });
    expect(res.urls).toEqual(['data:image/png;base64,aGVsbG8=']);
  });

  it('parses nested result.data format', () => {
    const res = parseImageGenerationResponse({
      result: { data: [{ url: 'https://cdn.example.com/img.png' }] },
    });
    expect(res.urls).toEqual(['https://cdn.example.com/img.png']);
  });

  it('parses output array format', () => {
    const res = parseImageGenerationResponse({
      output: [{ image_url: 'https://cdn.example.com/img.png' }],
    });
    expect(res.urls).toEqual(['https://cdn.example.com/img.png']);
  });

  it('deduplicates identical URLs', () => {
    const res = parseImageGenerationResponse({
      data: [{ url: 'https://cdn.example.com/img.png' }],
      url: 'https://cdn.example.com/img.png',
    });
    expect(res.urls).toEqual(['https://cdn.example.com/img.png']);
  });

  it('handles single non-array data object', () => {
    const res = parseImageGenerationResponse({
      data: { url: 'https://cdn.example.com/img.png' },
    });
    expect(res.urls).toEqual(['https://cdn.example.com/img.png']);
  });

  it('throws when response has no image data', () => {
    expect(() => parseImageGenerationResponse({ error: 'not found' }))
      .toThrow('生图 API 未返回图片');
  });

  it('throws on null input', () => {
    expect(() => parseImageGenerationResponse(null)).toThrow('生图 API 返回格式无效');
  });

  it('throws on non-object input', () => {
    expect(() => parseImageGenerationResponse('invalid')).toThrow('生图 API 返回格式无效');
  });
});
