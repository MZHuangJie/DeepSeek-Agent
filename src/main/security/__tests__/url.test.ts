import { describe, it, expect } from 'vitest';
import { validateExternalUrl } from '../../security/url';

describe('validateExternalUrl', () => {
  it('should allow public https URLs', () => {
    const url = validateExternalUrl('https://example.com/path');
    expect(url.hostname).toBe('example.com');
  });

  it('should reject localhost', () => {
    expect(() => validateExternalUrl('http://localhost:8080')).toThrow('内网或本地');
  });

  it('should reject 127.0.0.1', () => {
    expect(() => validateExternalUrl('http://127.0.0.1/admin')).toThrow('内网或本地');
  });

  it('should reject private IPv4', () => {
    expect(() => validateExternalUrl('http://192.168.1.1/')).toThrow('内网或本地');
    expect(() => validateExternalUrl('http://10.0.0.5/')).toThrow('内网或本地');
  });

  it('should reject file protocol', () => {
    expect(() => validateExternalUrl('file:///etc/passwd')).toThrow('仅允许 http/https');
  });

  it('should reject URLs with credentials', () => {
    expect(() => validateExternalUrl('https://user:pass@example.com')).toThrow('用户名或密码');
  });
});
