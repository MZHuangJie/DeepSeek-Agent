import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5MB

function getSessionDir(userId: number): string {
  const baseDir = process.env.WEB_DATA_DIR || path.join(process.cwd(), 'server', 'data');
  const dir = path.join(baseDir, 'sessions', String(userId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getSessionFile(userId: number, sessionId: string): string {
  return path.join(getSessionDir(userId), `${sessionId}.json`);
}

interface SessionMeta {
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
}

function safeParseInt(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    if (!isNaN(n)) return n;
  }
  return undefined;
}

// GET /sync/sessions — 列表
router.get('/sessions', requireAuth, (req, res) => {
  const userId = req.auth!.userId;
  const dir = getSessionDir(userId);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const sessions: SessionMeta[] = files.map(f => {
    const id = f.replace(/\.json$/, '');
    try {
      const raw = fs.readFileSync(path.join(dir, f), 'utf8');
      const data = JSON.parse(raw);
      const payload = typeof data.payload === 'string' ? JSON.parse(data.payload) : data.payload;
      const messages = Array.isArray(payload?.messages) ? payload.messages : [];
      return {
        id,
        title: data.title || '未命名会话',
        updatedAt: data.updatedAt || data.updated_at || 0,
        messageCount: messages.length,
      };
    } catch {
      return { id, title: '未命名会话', updatedAt: 0, messageCount: 0 };
    }
  });
  sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  res.json({ sessions });
});

// GET /sync/sessions/:id — 获取完整 payload
router.get('/sessions/:id', requireAuth, (req, res) => {
  const userId = req.auth!.userId;
  const sessionId = req.params.id;
  const filePath = getSessionFile(userId, sessionId);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: '会话不存在' });
    return;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    res.json({
      id: sessionId,
      title: data.title || '未命名会话',
      updatedAt: data.updatedAt || data.updated_at || 0,
      payload: data.payload || '{}',
    });
  } catch {
    res.status(500).json({ error: '读取会话失败' });
  }
});

// PUT /sync/sessions/:id — 上传/覆盖
router.put('/sessions/:id', requireAuth, (req, res) => {
  const userId = req.auth!.userId;
  const sessionId = req.params.id;
  const { title, payload } = req.body || {};

  if (typeof title !== 'string' || title.trim().length === 0) {
    res.status(400).json({ error: 'title 不能为空' });
    return;
  }
  if (typeof payload !== 'string') {
    res.status(400).json({ error: 'payload 必须是字符串' });
    return;
  }
  if (Buffer.byteLength(payload, 'utf8') > MAX_PAYLOAD_BYTES) {
    res.status(413).json({ error: '会话数据超过 5MB 上限' });
    return;
  }

  const filePath = getSessionFile(userId, sessionId);
  const data = {
    title: title.trim(),
    payload,
    updatedAt: Date.now(),
  };
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    let messageCount = 0;
    try {
      const parsed = JSON.parse(payload);
      messageCount = Array.isArray(parsed.messages) ? parsed.messages.length : 0;
    } catch { /* ignore */ }
    res.json({
      id: sessionId,
      title: data.title,
      updatedAt: data.updatedAt,
      messageCount,
    });
  } catch {
    res.status(500).json({ error: '保存会话失败' });
  }
});

// DELETE /sync/sessions/:id — 删除
router.delete('/sessions/:id', requireAuth, (req, res) => {
  const userId = req.auth!.userId;
  const sessionId = req.params.id;
  const filePath = getSessionFile(userId, sessionId);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: '会话不存在' });
    return;
  }
  try {
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: '删除会话失败' });
  }
});

// ---------- Characters ----------

function getCharacterDir(userId: number): string {
  const baseDir = process.env.WEB_DATA_DIR || path.join(process.cwd(), 'server', 'data');
  const dir = path.join(baseDir, 'characters', String(userId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getCharacterFile(userId: number, characterId: string): string {
  return path.join(getCharacterDir(userId), `${characterId}.json`);
}

interface CharacterMeta {
  id: string;
  name: string;
  updatedAt: number;
}

// GET /sync/characters
router.get('/characters', requireAuth, (req, res) => {
  const userId = req.auth!.userId;
  const dir = getCharacterDir(userId);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const characters: CharacterMeta[] = files.map(f => {
    const id = f.replace(/\.json$/, '');
    try {
      const raw = fs.readFileSync(path.join(dir, f), 'utf8');
      const data = JSON.parse(raw);
      return {
        id,
        name: data.name || '未命名角色',
        updatedAt: data.updatedAt || 0,
      };
    } catch {
      return { id, name: '未命名角色', updatedAt: 0 };
    }
  });
  characters.sort((a, b) => b.updatedAt - a.updatedAt);
  res.json({ characters });
});

// GET /sync/characters/:id
router.get('/characters/:id', requireAuth, (req, res) => {
  const userId = req.auth!.userId;
  const characterId = req.params.id;
  const filePath = getCharacterFile(userId, characterId);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: '角色不存在' });
    return;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    res.json({
      id: characterId,
      name: data.name || '未命名角色',
      updatedAt: data.updatedAt || 0,
      payload: data.payload || '{}',
    });
  } catch {
    res.status(500).json({ error: '读取角色失败' });
  }
});

// PUT /sync/characters/:id
router.put('/characters/:id', requireAuth, (req, res) => {
  const userId = req.auth!.userId;
  const characterId = req.params.id;
  const { name, payload } = req.body || {};

  if (typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'name 不能为空' });
    return;
  }
  if (typeof payload !== 'string') {
    res.status(400).json({ error: 'payload 必须是字符串' });
    return;
  }
  if (Buffer.byteLength(payload, 'utf8') > MAX_PAYLOAD_BYTES) {
    res.status(413).json({ error: '角色数据超过 5MB 上限' });
    return;
  }

  const filePath = getCharacterFile(userId, characterId);
  const data = {
    name: name.trim(),
    payload,
    updatedAt: Date.now(),
  };
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    res.json({
      id: characterId,
      name: data.name,
      updatedAt: data.updatedAt,
    });
  } catch {
    res.status(500).json({ error: '保存角色失败' });
  }
});

// DELETE /sync/characters/:id
router.delete('/characters/:id', requireAuth, (req, res) => {
  const userId = req.auth!.userId;
  const characterId = req.params.id;
  const filePath = getCharacterFile(userId, characterId);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: '角色不存在' });
    return;
  }
  try {
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: '删除角色失败' });
  }
});

export default router;
