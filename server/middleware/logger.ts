// 轻量结构化日志（避免 console.error 泄露敏感数据）
export function logError(tag: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  // 只记录类型和消息，不记录堆栈（可能含敏感路径）
  console.error(`[${tag}] ${message}`);
}

export function logInfo(tag: string, msg: string): void {
  console.log(`[${tag}] ${msg}`);
}
