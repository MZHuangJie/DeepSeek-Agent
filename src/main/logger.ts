import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'debug.log');

// 确保 logs 目录存在
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 首次写入时覆盖旧内容（应用重启后）
let initialized = false;

function fmtTime(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds()).toString().padStart(3, '0')}`;
}

export function debugLog(...args: any[]) {
  const line = `[${fmtTime(new Date())}] ${args.map(a =>
    typeof a === 'string' ? a : JSON.stringify(a)
  ).join(' ')}\n`;
  try {
    if (!initialized) {
      fs.writeFileSync(LOG_FILE, line, 'utf-8');
      initialized = true;
    } else {
      fs.appendFileSync(LOG_FILE, line, 'utf-8');
    }
  } catch {
    console.log(...args);
  }
}

export function getLogPath(): string {
  return LOG_FILE;
}
