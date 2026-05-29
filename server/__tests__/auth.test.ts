import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { validateCredentials } from '../middleware/requireAuth';

describe('validateCredentials', () => {
  it('accepts valid username and password', () => {
    expect(validateCredentials('demo_user', '123456')).toBeNull();
  });

  it('rejects short username', () => {
    expect(validateCredentials('ab', '123456')).toMatch(/用户名/);
  });

  it('rejects short password', () => {
    expect(validateCredentials('validname', '12345')).toMatch(/密码/);
  });

  it('rejects invalid username characters', () => {
    expect(validateCredentials('bad name!', '123456')).toMatch(/用户名/);
  });
});

describe('user store', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mycli-auth-'));
    process.env.WEB_DATA_DIR = tmpDir;
  });

  afterEach(async () => {
    const { resetStoreForTests } = await import('../db');
    resetStoreForTests();
    delete process.env.WEB_DATA_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates and finds users', async () => {
    const { createUser, findUserByUsername, findUserById, loadStore } = await import('../db');
    loadStore();
    const user = createUser('testuser', 'hash');
    expect(user.username).toBe('testuser');
    expect(findUserByUsername('TestUser')?.id).toBe(user.id);
    expect(findUserById(user.id)?.username).toBe('testuser');
  });
});
