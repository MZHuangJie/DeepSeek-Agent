import fs from 'fs';
import path from 'path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, `debug-${new Date().toISOString().slice(0, 10)}.log`);
const MAX_SIZE = 5 * 1024 * 1024;

const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
let currentLevel: LogLevel = process.env.NODE_ENV === 'development' ? 'debug' : 'info';

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 清理 7 天前的日志
function cleanOldLogs() {
  try {
    const files = fs.readdirSync(LOG_DIR);
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const f of files) {
      const fp = path.join(LOG_DIR, f);
      if (fs.statSync(fp).mtimeMs < cutoff) fs.unlinkSync(fp);
    }
  } catch {}
}
cleanOldLogs();

let initialized = false;

function fmtTime(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${d.getMilliseconds().toString().padStart(3, '0')}`;
}

export function setLogLevel(level: LogLevel) {
  currentLevel = level;
}

export function log(level: LogLevel, module: string, message: string, data?: Record<string, unknown>) {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[currentLevel]) return;

  const entry = JSON.stringify({
    t: fmtTime(new Date()),
    l: level,
    m: module,
    msg: message,
    ...(data ? { d: data } : {}),
  });
  const line = entry + '\n';
  try {
    if (!initialized) { fs.writeFileSync(LOG_FILE, line, 'utf-8'); initialized = true; }
    else {
      if (fs.statSync(LOG_FILE).size > MAX_SIZE) fs.writeFileSync(LOG_FILE, line, 'utf-8');
      else fs.appendFileSync(LOG_FILE, line, 'utf-8');
    }
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

/** @deprecated 请使用 log('debug', ...) 或 infoLog */
export function debugLog(...args: any[]) {
  if (LEVEL_WEIGHT['debug'] < LEVEL_WEIGHT[currentLevel]) return;
  const line = `[${fmtTime(new Date())}] [DEBUG] ${args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')}\n`;
  try {
    if (!initialized) { initialized = true; fs.writeFileSync(LOG_FILE, line, 'utf-8'); }
    else { fs.appendFileSync(LOG_FILE, line, 'utf-8'); }
  } catch {}
}

export function getLogPath(): string {
  return LOG_FILE;
}
