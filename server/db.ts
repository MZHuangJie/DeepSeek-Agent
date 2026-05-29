import { Pool } from 'pg';

export interface UserRow {
  id: number;
  username: string;
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
      password_hash VARCHAR(255) NOT NULL,
      created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
    );
  `);

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
    'SELECT id, username, password_hash, created_at FROM users WHERE LOWER(username) = LOWER($1)',
    [username.trim()]
  );
  return result.rows[0];
}

export async function findUserById(id: number): Promise<UserRow | undefined> {
  const result = await pool.query<UserRow>(
    'SELECT id, username, password_hash, created_at FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0];
}

export async function createUser(username: string, passwordHash: string): Promise<UserRow> {
  const result = await pool.query<UserRow>(
    `INSERT INTO users (username, password_hash, created_at)
     VALUES ($1, $2, $3)
     RETURNING id, username, password_hash, created_at`,
    [username.trim(), passwordHash, Date.now()]
  );
  return result.rows[0];
}

export async function updateUser(
  id: number,
  updates: Partial<Pick<UserRow, 'username'>>,
): Promise<UserRow | null> {
  if (updates.username !== undefined) {
    const result = await pool.query<UserRow>(
      'UPDATE users SET username = $1 WHERE id = $2 RETURNING id, username, password_hash, created_at',
      [updates.username.trim(), id]
    );
    return result.rows[0] || null;
  }
  return findUserById(id) || null;
}

// For tests only
export async function resetStoreForTests(): Promise<void> {
  await pool.query('DELETE FROM cloud_characters');
  await pool.query('DELETE FROM cloud_sessions');
  await pool.query('DELETE FROM users');
}
