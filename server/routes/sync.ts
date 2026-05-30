import { Router } from 'express';
import { getPool } from '../db';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();
const pool = getPool();

const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5MB

interface SessionMeta {
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
}

interface CharacterMeta {
  id: string;
  name: string;
  updatedAt: number;
}

// GET /sync/sessions — 列表
router.get('/sessions', requireAuth, async (_req, res) => {
  const userId = _req.auth!.userId;
  try {
    const result = await pool.query<SessionMeta>(
      `SELECT id, title, updated_at as "updatedAt", message_count as "messageCount"
       FROM cloud_sessions WHERE user_id = $1 ORDER BY updated_at DESC`,
      [userId]
    );
    res.json({ sessions: result.rows });
  } catch (err) {
    console.error('[sync/sessions]', err);
    res.status(500).json({ error: '读取会话列表失败' });
  }
});

// GET /sync/sessions/:id — 获取完整 payload
router.get('/sessions/:id', requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const sessionId = req.params.id;
  try {
    const result = await pool.query(
      'SELECT id, title, updated_at as "updatedAt", payload FROM cloud_sessions WHERE user_id = $1 AND id = $2',
      [userId, sessionId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: '会话不存在' });
      return;
    }
    res.json({
      id: result.rows[0].id,
      title: result.rows[0].title,
      updatedAt: result.rows[0].updatedAt,
      payload: result.rows[0].payload,
    });
  } catch (err) {
    console.error('[sync/sessions/:id]', err);
    res.status(500).json({ error: '读取会话失败' });
  }
});

// PUT /sync/sessions/:id — 上传/覆盖
router.put('/sessions/:id', requireAuth, async (req, res) => {
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

  let messageCount = 0;
  try {
    const parsed = JSON.parse(payload);
    messageCount = Array.isArray(parsed.messages) ? parsed.messages.length : 0;
  } catch { /* ignore */ }

  const updatedAt = Date.now();
  try {
    await pool.query(
      `INSERT INTO cloud_sessions (id, user_id, title, payload, message_count, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, id)
       DO UPDATE SET title = EXCLUDED.title, payload = EXCLUDED.payload,
                     message_count = EXCLUDED.message_count, updated_at = EXCLUDED.updated_at`,
      [sessionId, userId, title.trim(), payload, messageCount, updatedAt]
    );
    res.json({ id: sessionId, title: title.trim(), updatedAt, messageCount });
  } catch (err) {
    console.error('[sync/sessions/:id put]', err);
    res.status(500).json({ error: '保存会话失败' });
  }
});

// DELETE /sync/sessions/:id — 删除
router.delete('/sessions/:id', requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const sessionId = req.params.id;
  try {
    const result = await pool.query(
      'DELETE FROM cloud_sessions WHERE user_id = $1 AND id = $2',
      [userId, sessionId]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: '会话不存在' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[sync/sessions/:id delete]', err);
    res.status(500).json({ error: '删除会话失败' });
  }
});

// ---------- Characters ----------

// GET /sync/characters
router.get('/characters', requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  try {
    const result = await pool.query<CharacterMeta>(
      `SELECT id, name, updated_at as "updatedAt"
       FROM cloud_characters WHERE user_id = $1 ORDER BY updated_at DESC`,
      [userId]
    );
    res.json({ characters: result.rows });
  } catch (err) {
    console.error('[sync/characters]', err);
    res.status(500).json({ error: '读取角色列表失败' });
  }
});

// GET /sync/characters/:id
router.get('/characters/:id', requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const characterId = req.params.id;
  try {
    const result = await pool.query(
      'SELECT id, name, updated_at as "updatedAt", payload FROM cloud_characters WHERE user_id = $1 AND id = $2',
      [userId, characterId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: '角色不存在' });
      return;
    }
    res.json({
      id: result.rows[0].id,
      name: result.rows[0].name,
      updatedAt: result.rows[0].updatedAt,
      payload: result.rows[0].payload,
    });
  } catch (err) {
    console.error('[sync/characters/:id]', err);
    res.status(500).json({ error: '读取角色失败' });
  }
});

// PUT /sync/characters/:id
router.put('/characters/:id', requireAuth, async (req, res) => {
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

  const updatedAt = Date.now();
  try {
    await pool.query(
      `INSERT INTO cloud_characters (id, user_id, name, payload, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, id)
       DO UPDATE SET name = EXCLUDED.name, payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at`,
      [characterId, userId, name.trim(), payload, updatedAt]
    );
    res.json({ id: characterId, name: name.trim(), updatedAt });
  } catch (err) {
    console.error('[sync/characters/:id put]', err);
    res.status(500).json({ error: '保存角色失败' });
  }
});

// DELETE /sync/characters/:id
router.delete('/characters/:id', requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const characterId = req.params.id;
  try {
    const result = await pool.query(
      'DELETE FROM cloud_characters WHERE user_id = $1 AND id = $2',
      [userId, characterId]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: '角色不存在' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[sync/characters/:id delete]', err);
    res.status(500).json({ error: '删除角色失败' });
  }
});

// ---------- Templates ----------

interface TemplateMeta {
  id: string;
  name: string;
  updatedAt: number;
}

// GET /sync/templates
router.get('/templates', requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  try {
    const result = await pool.query<TemplateMeta>(
      `SELECT id, name, updated_at as "updatedAt"
       FROM cloud_templates WHERE user_id = $1 ORDER BY updated_at DESC`,
      [userId]
    );
    res.json({ templates: result.rows });
  } catch (err) {
    console.error('[sync/templates]', err);
    res.status(500).json({ error: '读取模板列表失败' });
  }
});

// GET /sync/templates/:id
router.get('/templates/:id', requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const templateId = req.params.id;
  try {
    const result = await pool.query(
      'SELECT id, name, updated_at as "updatedAt", payload FROM cloud_templates WHERE user_id = $1 AND id = $2',
      [userId, templateId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: '模板不存在' });
      return;
    }
    res.json({
      id: result.rows[0].id,
      name: result.rows[0].name,
      updatedAt: result.rows[0].updatedAt,
      payload: result.rows[0].payload,
    });
  } catch (err) {
    console.error('[sync/templates/:id]', err);
    res.status(500).json({ error: '读取模板失败' });
  }
});

// PUT /sync/templates/:id
router.put('/templates/:id', requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const templateId = req.params.id;
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
    res.status(413).json({ error: '模板数据超过 5MB 上限' });
    return;
  }

  const updatedAt = Date.now();
  try {
    await pool.query(
      `INSERT INTO cloud_templates (id, user_id, name, payload, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, id)
       DO UPDATE SET name = EXCLUDED.name, payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at`,
      [templateId, userId, name.trim(), payload, updatedAt]
    );
    res.json({ id: templateId, name: name.trim(), updatedAt });
  } catch (err) {
    console.error('[sync/templates/:id put]', err);
    res.status(500).json({ error: '保存模板失败' });
  }
});

// DELETE /sync/templates/:id
router.delete('/templates/:id', requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const templateId = req.params.id;
  try {
    const result = await pool.query(
      'DELETE FROM cloud_templates WHERE user_id = $1 AND id = $2',
      [userId, templateId]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: '模板不存在' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[sync/templates/:id delete]', err);
    res.status(500).json({ error: '删除模板失败' });
  }
});

export default router;
