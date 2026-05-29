import fs from 'fs';
import path from 'path';

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  created_at: number;
}

interface UserStore {
  nextId: number;
  users: UserRow[];
}

let store: UserStore | null = null;

function getStorePath(): string {
  const dataDir = process.env.WEB_DATA_DIR || path.join(process.cwd(), 'server', 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  return path.join(dataDir, 'users.json');
}

function saveStore(): void {
  if (!store) return;
  fs.writeFileSync(getStorePath(), JSON.stringify(store, null, 2), 'utf8');
}

export function resetStoreForTests(): void {
  store = null;
}

/** 启动时加载用户数据 */
export function loadStore(): UserStore {
  if (store) return store;
  const filePath = getStorePath();
  if (fs.existsSync(filePath)) {
    store = JSON.parse(fs.readFileSync(filePath, 'utf8')) as UserStore;
    return store;
  }
  store = { nextId: 1, users: [] };
  saveStore();
  return store;
}

export function findUserByUsername(username: string): UserRow | undefined {
  const normalized = username.trim().toLowerCase();
  return loadStore().users.find(u => u.username.toLowerCase() === normalized);
}

export function findUserById(id: number): UserRow | undefined {
  return loadStore().users.find(u => u.id === id);
}

export function createUser(username: string, passwordHash: string): UserRow {
  const s = loadStore();
  const user: UserRow = {
    id: s.nextId++,
    username: username.trim(),
    password_hash: passwordHash,
    created_at: Date.now(),
  };
  s.users.push(user);
  saveStore();
  return user;
}

export function updateUser(id: number, updates: Partial<Pick<UserRow, 'username'>>): UserRow | null {
  const s = loadStore();
  const user = s.users.find(u => u.id === id);
  if (!user) return null;
  if (updates.username !== undefined) {
    user.username = updates.username.trim();
  }
  saveStore();
  return user;
}
