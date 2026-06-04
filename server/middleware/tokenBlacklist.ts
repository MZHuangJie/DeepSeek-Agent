// Token 黑名单 — 登出后立即失效，防止 token 泄露后被滥用
// 生产环境应改用 Redis，此处使用内存 Map（重启后清空，token 最长 7 天）

interface BlacklistEntry {
  userId: number;
  expiresAt: number; // 与 token 原始过期时间一致
}

const blacklist = new Map<string, BlacklistEntry>();

// 每 10 分钟清理过期条目
setInterval(() => {
  const now = Date.now();
  for (const [jti, entry] of blacklist) {
    if (entry.expiresAt <= now) blacklist.delete(jti);
  }
}, 10 * 60 * 1000);

export function revokeToken(jti: string, userId: number, expiresAt: number): void {
  blacklist.set(jti, { userId, expiresAt });
}

export function isTokenRevoked(jti: string): boolean {
  const entry = blacklist.get(jti);
  if (!entry) return false;
  if (entry.expiresAt <= Date.now()) {
    blacklist.delete(jti);
    return false;
  }
  return true;
}

export function revokeAllUserTokens(userId: number): void {
  for (const [jti, entry] of blacklist) {
    if (entry.userId === userId) blacklist.delete(jti);
  }
}
