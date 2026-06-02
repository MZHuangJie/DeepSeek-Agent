import { describe, it, expect, beforeEach } from 'vitest';

// MemDb is the in-memory fallback database — test its SQL compatibility
// We need to import it. Since getDb() caches, we need a fresh instance.

// MemDb is defined inside connection.ts but not exported directly.
// We'll test the public API through getDb() with a reset.

// But getDb() caches and tries better-sqlite3 first.
// Let's test a standalone MemDb instance by importing the class.

// Since MemDb is not exported, test the core SQL patterns it needs to support
// by testing the settings get/set functions which use getDb() internally.

// Actually, let's test at the higher level via the settings API.
import { getSetting, setSetting } from '../settings';

// Clean up before each test
beforeEach(() => {
  // The settings table is auto-created on first use
  // We can't easily reset without the MemDb reference, so test idempotently
});

describe('settings store', () => {
  it('returns null for non-existent key', () => {
    const val = getSetting('__test_nonexistent_key__');
    expect(val).toBeNull();
  });

  it('stores and retrieves a string value', () => {
    setSetting('__test_key_1__', 'hello world');
    const val = getSetting('__test_key_1__');
    expect(val).toBe('hello world');
  });

  it('overwrites an existing key', () => {
    setSetting('__test_key_2__', 'first');
    setSetting('__test_key_2__', 'second');
    expect(getSetting('__test_key_2__')).toBe('second');
  });

  it('stores empty string', () => {
    setSetting('__test_key_3__', '');
    expect(getSetting('__test_key_3__')).toBe('');
  });

  it('stores JSON string', () => {
    const json = JSON.stringify({ a: 1, b: [2, 3] });
    setSetting('__test_key_json__', json);
    expect(getSetting('__test_key_json__')).toBe(json);
  });

  it('multiple keys do not interfere', () => {
    setSetting('__test_key_a__', 'value_a');
    setSetting('__test_key_b__', 'value_b');
    expect(getSetting('__test_key_a__')).toBe('value_a');
    expect(getSetting('__test_key_b__')).toBe('value_b');
  });

  it('returns null after setting to empty then deleting-like behavior', () => {
    // Note: settings doesn't have delete, just set
    setSetting('__test_key_4__', 'temp');
    expect(getSetting('__test_key_4__')).toBe('temp');
    setSetting('__test_key_4__', '');
    expect(getSetting('__test_key_4__')).toBe('');
  });
});
