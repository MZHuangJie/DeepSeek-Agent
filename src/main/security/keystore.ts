import { safeStorage } from 'electron';
import { setSetting, getSetting } from '../db/settings';

export function saveApiKey(key: string) {
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(key);
    setSetting('api_key_encrypted', encrypted.toString('base64'));
  } else {
    setSetting('api_key', key);
  }
}

export function getApiKey(): string | null {
  if (safeStorage.isEncryptionAvailable()) {
    const encryptedB64 = getSetting('api_key_encrypted');
    if (!encryptedB64) return null;
    const encrypted = Buffer.from(encryptedB64, 'base64');
    return safeStorage.decryptString(encrypted);
  }
  return getSetting('api_key');
}
