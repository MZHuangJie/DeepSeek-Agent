import fs from 'fs';
import path from 'path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'debug.log');
const MAX_SIZE = 5 * 1024 * 1024; // 5MB 轮转

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

let initialized = false;

function fmtTime(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds()).toString().padStart(3, '0')}`;
}

function rotateIfNeeded() {
  try {
    const stat = fs.statSync(LOG_FILE);
    if (stat.size > MAX_SIZE) {
      const bak = LOG_FILE.replace('.log', `.${Date.now()}.bak`);
      fs.renameSync(LOG_FILE, bak);
      initialized = false;
    }
  } catch {}
}

export function log(level: LogLevel, module: string, message: string, data?: Record<string, unknown>) {
  const entry = JSON.stringify({
    t: fmtTime(new Date()),
    l: level,
    m: module,
    msg: message,
    ...(data ? { d: data } : {}),
  });
  const line = entry + '\n';
  try {
    rotateIfNeeded();
    if (!initialized) {
      fs.writeFileSync(LOG_FILE, line, 'utf-8');
      initialized = true;
    } else {
      fs.appendFileSync(LOG_FILE, line, 'utf-8');
    }
  } catch {
    // 日志写入失败时静默降级
  }
}

// 便捷函数
export function debugLog(...args: any[]) {
  log('debug', module, message, data);
}

export function infoLog(module: string, message: string, data?: Record<string, unknown>) {
  log('info', module, message, data);
}

export function warnLog(module: string, message: string, data?: Record<string, unknown>) {
  log('warn', module, message, data);
}

export function errorLog(module: string, message: string, data?: Record<string, unknown>) {
  log('error', module, message, data);
}

export function getLogPath(): string {
  return LOG_FILE;
}
