import { getDb } from './connection';

export function saveSession(id: string, title: string, messages: string) {
  const db = getDb();
  const now = Date.now();
  const existing = db.prepare('SELECT id, created_at FROM sessions WHERE id = ?').get(id) as any;
  const createdAt = existing?.created_at ?? now;
  db.prepare(`
    INSERT OR REPLACE INTO sessions (id, title, messages, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, title, messages, createdAt, now);
}

export function loadSessions(): Array<{ id: string; title: string; messages: string }> {
  const db = getDb();
  return db.prepare('SELECT id, title, messages FROM sessions ORDER BY updated_at DESC').all() as any[];
}

export function deleteSession(id: string) {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
}
