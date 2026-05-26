import fs from 'fs';
import path from 'path';

export function safeResolve(baseDir: string, targetPath: string): string {
  const resolved = path.resolve(baseDir, targetPath);
  const normalizedBase = path.resolve(baseDir) + path.sep;
  if (!resolved.startsWith(normalizedBase) && resolved !== path.resolve(baseDir)) {
    throw new Error(`路径越界: ${targetPath} 不在项目目录内`);
  }
  try {
    const realPath = fs.realpathSync(resolved);
    const realBase = fs.realpathSync(baseDir);
    if (!realPath.startsWith(realBase + path.sep) && realPath !== realBase) {
      throw new Error(`路径越界: ${targetPath} 不在项目目录内`);
    }
    return realPath;
  } catch (e: any) {
    if (e.message?.includes('路径越界')) throw e;
    return resolved;
  }
}

const SENSITIVE_NAMES = new Set([
  '.env', '.env.local', '.env.production', '.env.development',
  'id_rsa', 'id_ed25519', 'id_ecdsa', 'credentials.json', '.credentials',
  '.npmrc', '.pypirc', 'authorized_keys', 'known_hosts',
]);

const SENSITIVE_EXTS = new Set(['.pem', '.key', '.pfx', '.p12', '.jks', '.keystore']);

export function checkSensitiveFile(filePath: string, action: 'read' | 'write' = 'read'): void {
  const fileName = path.basename(filePath);
  const ext = path.extname(fileName);
  if (SENSITIVE_NAMES.has(fileName) || SENSITIVE_EXTS.has(ext)) {
    throw new Error(`${action === 'read' ? '读取' : '写入'}敏感文件被拒绝`);
  }
}

const DANGEROUS_COMMAND_PATTERNS = [
  /\bsudo\b/i, /\bdoas\b/i,
  /\brm\s+-rf\s+\//i, /\brm\s+-rf\s+~\//i,
  /\bdd\s+if=/i, /\bmkfs\.?\s/i,
  />[\s]*\/dev\/(sd|hd|nvme|xvd|vd|mmcblk)/i,
  /\bchmod\s+-R\s+777\b/i,
  /:\(\)\s*\{/,
  /\b(curl|wget)\b.+\|\s*(ba)?sh\b/i,
  /\bnc\s+-[e|l]\s/i, /\bncat\s+-[e|l]\s/i,
  // Windows / PowerShell
  /\bRemove-Item\b.*-Recurse\b/i,
  /\b(Invoke-Expression|iex)\b/i,
  /\bFormat-Volume\b/i,
  /\bdel\s+\/[sfq]/i,
  /\b(Invoke-WebRequest|iwr)\b.+\|\s*(iex|Invoke-Expression)\b/i,
];

export function checkDangerousCommand(command: string): void {
  for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
    if (pattern.test(command)) {
      throw new Error('命令包含危险操作，已被拒绝');
    }
  }
}
