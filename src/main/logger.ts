import fs from 'fs';
import path from 'path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'debug.log');
const MAX_SIZE = 5 * 1024 * 1024;

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 每次启动覆盖日志
let initialized = false;

function fmtTime(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${d.getMilliseconds().toString().padStart(3, '0')}`;
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
    if (!initialized) {
      fs.writeFileSync(LOG_FILE, line, 'utf-8');
      initialized = true;
    } else {
      const stat = fs.statSync(LOG_FILE);
      if (stat.size > MAX_SIZE) {
        fs.writeFileSync(LOG_FILE, line, 'utf-8');
      } else {
        fs.appendFileSync(LOG_FILE, line, 'utf-8');
      }
    }
  } catch {}
}

export function debugLog(...args: any[]) {
  const line = `[${fmtTime(new Date())}] [DEBUG] ${args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')}\n`;
  try {
    if (!initialized) { initialized = true; fs.writeFileSync(LOG_FILE, line, 'utf-8'); }
    else { fs.appendFileSync(LOG_FILE, line, 'utf-8'); }
  } catch {}
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
