import { Pool } from 'pg';

export interface UserRow {
  id: number;
  username: string;
  email: string | null;
  avatar: string | null;
  password_hash: string;
  created_at: number;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export function getPool(): Pool {
  return pool;
}

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(32) UNIQUE NOT NULL,
      email VARCHAR(255),
      avatar TEXT,
      password_hash VARCHAR(255) NOT NULL,
      created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
    );
  `);
  // 兼容已有表
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255)`);
  } catch { /* ignore */ }
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT`);
  } catch { /* ignore */ }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cloud_sessions (
      id VARCHAR(64) NOT NULL,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      payload TEXT NOT NULL,
      message_count INT NOT NULL DEFAULT 0,
      updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
      PRIMARY KEY (user_id, id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cloud_characters (
      id VARCHAR(64) NOT NULL,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      payload TEXT NOT NULL,
      shared BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
      PRIMARY KEY (user_id, id)
    );
  `);
  // 兼容已有表
  try {
    await pool.query(`ALTER TABLE cloud_characters ADD COLUMN IF NOT EXISTS shared BOOLEAN NOT NULL DEFAULT FALSE`);
  } catch { /* ignore */ }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cloud_templates (
      id VARCHAR(64) NOT NULL,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      payload TEXT NOT NULL,
      updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
      PRIMARY KEY (user_id, id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cloud_models (
      id VARCHAR(64) NOT NULL,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      provider VARCHAR(64) NOT NULL,
      base_url VARCHAR(512) NOT NULL DEFAULT '',
      model_id VARCHAR(128) NOT NULL DEFAULT '',
      context_window INT NOT NULL DEFAULT 64000,
      shared BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
      PRIMARY KEY (user_id, id)
    );
  `);

  // 角色广场：已有表增加 shared 列
  try {
    await pool.query(`ALTER TABLE cloud_characters ADD COLUMN IF NOT EXISTS shared BOOLEAN NOT NULL DEFAULT FALSE`);
  } catch { /* ignore */ }
  try {
    await pool.query(`ALTER TABLE cloud_templates ADD COLUMN IF NOT EXISTS shared BOOLEAN NOT NULL DEFAULT FALSE`);
  } catch { /* ignore */ }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cloud_models (
      id VARCHAR(64) NOT NULL,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      provider VARCHAR(32) NOT NULL,
      base_url VARCHAR(512) NOT NULL,
      model_id VARCHAR(128) NOT NULL,
      context_window INT NOT NULL DEFAULT 64000,
      shared BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
      PRIMARY KEY (user_id, id)
    );
  `);
}

export async function findUserByUsername(username: string): Promise<UserRow | undefined> {
  const result = await pool.query<UserRow>(
    'SELECT id, username, email, avatar, password_hash, created_at FROM users WHERE LOWER(username) = LOWER($1)',
    [username.trim()]
  );
  return result.rows[0];
}

export async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  const result = await pool.query<UserRow>(
    'SELECT id, username, email, avatar, password_hash, created_at FROM users WHERE LOWER(email) = LOWER($1)',
    [email.trim()]
  );
  return result.rows[0];
}

export async function findUserById(id: number): Promise<UserRow | undefined> {
  const result = await pool.query<UserRow>(
    'SELECT id, username, email, avatar, password_hash, created_at FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0];
}

export async function createUser(username: string, passwordHash: string, email?: string): Promise<UserRow> {
  const result = await pool.query<UserRow>(
    `INSERT INTO users (username, email, password_hash, created_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, username, email, avatar, password_hash, created_at`,
    [username.trim(), email?.trim() || null, passwordHash, Date.now()]
  );
  return result.rows[0];
}

export async function updateUser(
  id: number,
  updates: Partial<Pick<UserRow, 'username' | 'email' | 'avatar'>>,
): Promise<UserRow | null> {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  let idx = 1;

  if (updates.username !== undefined) {
    sets.push(`username = $${idx++}`);
    values.push(updates.username.trim());
  }
  if (updates.email !== undefined) {
    sets.push(`email = $${idx++}`);
    values.push(updates.email?.trim() || null);
  }
  if (updates.avatar !== undefined) {
    sets.push(`avatar = $${idx++}`);
    values.push(updates.avatar || null);
  }

  if (sets.length === 0) return findUserById(id) || null;

  values.push(id);
  const result = await pool.query<UserRow>(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, username, email, avatar, password_hash, created_at`,
    values
  );
  return result.rows[0] || null;
}

// For tests only
export async function resetStoreForTests(): Promise<void> {
  await pool.query('DELETE FROM cloud_models');
  await pool.query('DELETE FROM cloud_templates');
  await pool.query('DELETE FROM cloud_characters');
  await pool.query('DELETE FROM cloud_sessions');
  await pool.query('DELETE FROM users');
}
