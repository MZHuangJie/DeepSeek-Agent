import path from 'path';
import { app } from 'electron';
import fs from 'fs';

interface Stmt {
  run(...args: any[]): void;
  all(...args: any[]): any[];
  get(...args: any[]): any;
}

interface DbLike {
  exec(sql: string): void;
  prepare(sql: string): Stmt;
  pragma(sql: string): void;
}

let db: DbLike | null = null;

class MemDb implements DbLike {
  private tables = new Map<string, Map<string, any>>();

  exec(sql: string) {
    const match = sql.match(/CREATE TABLE IF NOT EXISTS (\w+) \((.*)\)/s);
    if (match) {
      const tableName = match[1];
      if (!this.tables.has(tableName)) {
        this.tables.set(tableName, new Map());
      }
    }
  }

  prepare(sql: string): Stmt {
    const self = this;
    return {
      run: (...args: any[]) => {
        if (sql.includes('INSERT INTO sessions') || sql.includes('INSERT OR REPLACE INTO sessions')) {
          const row = { id: args[0], title: args[1], messages: args[2], created_at: args[3], updated_at: args[4] };
          const sessions = self.tables.get('sessions') || new Map();
          const existing = sessions.get(args[0]);
          if (existing && args.length > 5) {
            // ON CONFLICT UPDATE: preserve created_at
            sessions.set(args[0], { ...row, created_at: existing.created_at });
          } else {
            sessions.set(args[0], row);
          }
          self.tables.set('sessions', sessions);
        } else if (sql.includes('INSERT INTO settings')) {
          const key = args[0];
          const value = args[1];
          const settings = self.tables.get('settings') || new Map();
          settings.set(key, { key, value });
          self.tables.set('settings', settings);
        } else if (sql.includes('DELETE FROM sessions')) {
          const sessions = self.tables.get('sessions') || new Map();
          sessions.delete(args[0]);
        }
      },
      all: (...args: any[]) => {
        if (sql.includes('FROM sessions')) {
          const sessions = self.tables.get('sessions') || new Map();
          return Array.from(sessions.values()).sort((a: any, b: any) => (b.updated_at || 0) - (a.updated_at || 0));
        }
        if (sql.includes('FROM settings')) {
          const key = args[0];
          const settings = self.tables.get('settings') || new Map();
          const row = settings.get(key);
          return row ? [row] : [];
        }
        return [];
      },
      get: (...args: any[]) => {
        if (sql.includes('FROM settings')) {
          const key = args[0];
          const settings = self.tables.get('settings') || new Map();
          return settings.get(key) || null;
        }
        return null;
      },
    };
  }

  pragma(_sql: string) {}
}

export function getDb(): DbLike {
  if (db) return db;
  try {
    const Database = require('better-sqlite3');
    const dbPath = path.join(app.getPath('userData'), 'deepseek-agent.db');
    db = new Database(dbPath);
    (db as any).pragma('journal_mode = WAL');
    initSchema();
    return db;
  } catch {
    db = new MemDb();
    initSchema();
    return db;
  }
}

function initSchema() {
  db!.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      messages TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}
