import { getDatabase } from './connection';

export function saveConversation(id: string, title: string, payload: string) {
  const db = getDatabase();
  db.run(
    `INSERT OR REPLACE INTO conversations (id, title, payload, created_at, updated_at)
     VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
    [id, title, payload]
  );
}

export function loadAllConversations(): Array<{ id: string; title: string; payload: string }> {
  const db = getDatabase();
  return db.all('SELECT id, title, payload FROM conversations ORDER BY updated_at DESC');
}

export function deleteConversation(id: string) {
  const db = getDatabase();
  db.run('DELETE FROM conversations WHERE id = ?', [id]);
}
