import { Pool } from 'pg';

export interface UserRow {
  id: number;
  username: string;
  email: string | null;
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
      password_hash VARCHAR(255) NOT NULL,
      created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
    );
  `);
  // 兼容已有表：添加 email 字段
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255)`);
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
      updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
      PRIMARY KEY (user_id, id)
    );
  `);
}

export async function findUserByUsername(username: string): Promise<UserRow | undefined> {
  const result = await pool.query<UserRow>(
    'SELECT id, username, email, password_hash, created_at FROM users WHERE LOWER(username) = LOWER($1)',
    [username.trim()]
  );
  return result.rows[0];
}

export async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  const result = await pool.query<UserRow>(
    'SELECT id, username, email, password_hash, created_at FROM users WHERE LOWER(email) = LOWER($1)',
    [email.trim()]
  );
  return result.rows[0];
}

export async function findUserById(id: number): Promise<UserRow | undefined> {
  const result = await pool.query<UserRow>(
    'SELECT id, username, email, password_hash, created_at FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0];
}

export async function createUser(username: string, passwordHash: string, email?: string): Promise<UserRow> {
  const result = await pool.query<UserRow>(
    `INSERT INTO users (username, email, password_hash, created_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, username, email, password_hash, created_at`,
    [username.trim(), email?.trim() || null, passwordHash, Date.now()]
  );
  return result.rows[0];
}

export async function updateUser(
  id: number,
  updates: Partial<Pick<UserRow, 'username' | 'email'>>,
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

  if (sets.length === 0) return findUserById(id) || null;

  values.push(id);
  const result = await pool.query<UserRow>(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, username, email, password_hash, created_at`,
    values
  );
  return result.rows[0] || null;
}

// For tests only
export async function resetStoreForTests(): Promise<void> {
  await pool.query('DELETE FROM cloud_characters');
  await pool.query('DELETE FROM cloud_sessions');
  await pool.query('DELETE FROM users');
}
