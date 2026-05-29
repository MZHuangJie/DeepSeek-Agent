import { safeStorage, app } from 'electron';
import crypto from 'crypto';
import { getSetting, setSetting } from '../db/settings';

const AUTH_TOKEN_KEY = 'auth_token_encrypted';
const AUTH_TOKEN_CRYPTO_KEY = 'auth_token_crypto';
const AUTH_API_BASE_KEY = 'auth_api_base';

export const DEFAULT_AUTH_API_BASE = 'https://dominusgame.top/ds/api';

function getFallbackKey(): Buffer {
  const seed = app.getPath('userData') + app.getVersion() + ':auth';
  return crypto.createHash('sha256').update(seed).digest();
}

function encryptWithCrypto(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decryptWithCrypto(payload: string, key: Buffer): string | null {
  try {
    const buf = Buffer.from(payload, 'base64');
    const iv = buf.subarray(0, 16);
    const tag = buf.subarray(16, 32);
    const encrypted = buf.subarray(32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf-8');
  } catch {
    return null;
  }
}

export function getAuthApiBase(): string {
  return DEFAULT_AUTH_API_BASE;
}

export function isAuthApiBaseEditable(): boolean {
  return false;
}

export function setAuthApiBase(_baseUrl: string): void {
  // 服务器地址固定，不可修改
}

export function saveAuthToken(token: string): void {
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(token);
    setSetting(AUTH_TOKEN_KEY, encrypted.toString('base64'));
    setSetting(AUTH_TOKEN_CRYPTO_KEY, '');
  } else {
    setSetting(AUTH_TOKEN_CRYPTO_KEY, encryptWithCrypto(token, getFallbackKey()));
    setSetting(AUTH_TOKEN_KEY, '');
  }
}

export function getAuthToken(): string | null {
  if (safeStorage.isEncryptionAvailable()) {
    const encryptedB64 = getSetting(AUTH_TOKEN_KEY);
    if (!encryptedB64) return null;
    try {
      const encrypted = Buffer.from(encryptedB64, 'base64');
      return safeStorage.decryptString(encrypted);
    } catch {
      return null;
    }
  }
  const payload = getSetting(AUTH_TOKEN_CRYPTO_KEY);
  if (!payload) return null;
  return decryptWithCrypto(payload, getFallbackKey());
}

export function clearAuthToken(): void {
  setSetting(AUTH_TOKEN_KEY, '');
  setSetting(AUTH_TOKEN_CRYPTO_KEY, '');
}
