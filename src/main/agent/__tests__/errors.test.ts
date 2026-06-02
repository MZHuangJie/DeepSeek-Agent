import { describe, it, expect } from 'vitest';
import { classifyApiError, AppError } from '../errors';

describe('classifyApiError', () => {
  it('should classify context overflow', () => {
    const err = classifyApiError(400, 'maximum context length is 1048576 tokens');
    expect(err.code).toBe('CONTEXT_OVERFLOW');
    expect(err.recoverable).toBe(true);
  });

  it('should classify rate limit', () => {
    const err = classifyApiError(429, 'rate limit exceeded');
    expect(err.code).toBe('RATE_LIMIT');
    expect(err.recoverable).toBe(true);
  });

  it('should classify auth error', () => {
    const err = classifyApiError(401, 'Invalid API Key');
    expect(err.code).toBe('AUTH');
    expect(err.recoverable).toBe(false);
  });

  it('should classify timeout', () => {
    const err = classifyApiError(500, 'Request timeout');
    expect(err.code).toBe('TIMEOUT');
    expect(err.recoverable).toBe(true);
  });

  it('should classify generic API error', () => {
    const err = classifyApiError(500, 'Internal Server Error');
    expect(err.code).toBe('API');
    expect(err.recoverable).toBe(false);
  });
});
