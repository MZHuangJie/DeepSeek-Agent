export type ErrorCode = 'NETWORK' | 'API' | 'CONTEXT_OVERFLOW' | 'RATE_LIMIT' | 'AUTH' | 'SECURITY' | 'TIMEOUT';

export class AppError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public userMessage: string,
    public recoverable: boolean = false
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function classifyApiError(status: number, message: string): AppError {
  // Context overflow
  if (message.includes('maximum context length') || message.includes('1048576')) {
    return new AppError(message, 'CONTEXT_OVERFLOW', '对话内容过长，正在自动压缩并重试...', true);
  }
  // Rate limit
  if (status === 429 || message.includes('rate_limit') || message.includes('RateLimit')) {
    return new AppError(message, 'RATE_LIMIT', '请求频率过高，请稍后重试', true);
  }
  // Auth
  if (status === 401 || status === 403 || message.includes('Invalid API Key') || message.includes('Unauthorized')) {
    return new AppError(message, 'AUTH', 'API Key 无效或已过期，请检查设置', false);
  }
  // Timeout
  if (message.includes('timeout') || message.includes('Timeout') || message.includes('超时')) {
    return new AppError(message, 'TIMEOUT', '请求超时，正在重试...', true);
  }
  // Generic API error
  return new AppError(message, 'API', `API 错误 (${status}): ${message.slice(0, 200)}`, false);
}

export function isRecoverableError(err: unknown): boolean {
  if (err instanceof AppError) return err.recoverable;
  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    // Network errors are recoverable
    if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNREFUSED' || code === 'ENOTFOUND') return true;
  }
  return false;
}
