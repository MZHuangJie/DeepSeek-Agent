import { safeStorage, app } from 'electron';
import crypto from 'crypto';
import { setSetting, getSetting } from '../db/settings';

function getFallbackKey(): Buffer {
  const seed = app.getPath('userData') + app.getVersion();
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

export function saveApiKey(key: string) {
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(key);
    setSetting('api_key_encrypted', encrypted.toString('base64'));
  } else {
    const fallbackKey = getFallbackKey();
    setSetting('api_key_crypto', encryptWithCrypto(key, fallbackKey));
  }
}

export function getApiKey(): string | null {
  if (safeStorage.isEncryptionAvailable()) {
    const encryptedB64 = getSetting('api_key_encrypted');
    if (!encryptedB64) return null;
    const encrypted = Buffer.from(encryptedB64, 'base64');
    return safeStorage.decryptString(encrypted);
  }
  const payload = getSetting('api_key_crypto');
  if (!payload) {
    // 迁移旧版明文数据
    const plaintext = getSetting('api_key');
    if (plaintext) {
      saveApiKey(plaintext);
      return plaintext;
    }
    return null;
  }
  return decryptWithCrypto(payload, getFallbackKey());
}
