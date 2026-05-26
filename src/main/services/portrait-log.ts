import { infoLog, warnLog, errorLog, log } from '../logger';
import { maskSecret, truncateText, summarizeUrl, summarizeUrls } from './log-sanitize';

const MODULE = 'roleplay-portrait';

export function portraitInfo(message: string, data?: Record<string, unknown>) {
  infoLog(MODULE, message, data);
}

export function portraitWarn(message: string, data?: Record<string, unknown>) {
  warnLog(MODULE, message, data);
}

export function portraitError(message: string, data?: Record<string, unknown>) {
  errorLog(MODULE, message, data);
}

export function portraitDebug(message: string, data?: Record<string, unknown>) {
  log('debug', MODULE, message, data);
}

export { maskSecret, truncateText, summarizeUrl, summarizeUrls };
