import { Router } from 'express';
import { getPool } from '../db';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();
const pool = getPool();

// ── Character Square ──

interface SquareCharacterRow {
  id: string;
  name: string;
  payload: string;
  shared: boolean;
  heat: number;
  updated_at: number;
  user_id: number;
  username: string;
}

// GET /square/characters — 广场角色列表（跨用户，仅 shared=true，无需登录）
router.get('/characters', async (req, res) => {
  const userId = (req as any).auth?.userId as number | undefined;
  try {
    const result = await pool.query<SquareCharacterRow>(
      `SELECT cc.id, cc.name, cc.payload, cc.shared, cc.heat, cc.updated_at, cc.user_id, u.username
       FROM cloud_characters cc
       JOIN users u ON u.id = cc.user_id
       WHERE cc.shared = TRUE
       ORDER BY cc.heat DESC, cc.updated_at DESC
       LIMIT 100`
    );
    // 如果登录了，查该用户的收藏列表
    let favIds = new Set<string>();
    if (userId) {
      const favRes = await pool.query<{ character_id: string }>(
        'SELECT character_id FROM favorites WHERE user_id = $1',
        [userId]
      );
      favIds = new Set(favRes.rows.map(r => r.character_id));
    }
    const characters = result.rows.map(r => {
      let portraitBase64: string | undefined;
      let portraitFullBase64: string | undefined;
      let personality: string | undefined;
      let background: string | undefined;
      let gender: string | undefined;
      let occupation: string | undefined;
      try {
        const p = JSON.parse(r.payload);
        portraitBase64 = p.portraitBase64;
        portraitFullBase64 = p.portraitFullBase64;
        personality = p.personality;
        background = p.background;
        gender = p.gender;
        occupation = p.occupation;
      } catch { /* ignore */ }
      return {
        id: r.id,
        name: r.name,
        userName: r.username,
        portraitBase64,
        portraitFullBase64,
        personality,
        background,
        gender,
        occupation,
        heat: r.heat || 0,
        isFavorited: favIds.has(r.id),
        updatedAt: r.updated_at,
      };
    });
    res.json({ characters });
  } catch (err) {
    console.error('[square/characters]', err);
    res.status(500).json({ error: '读取广场角色失败' });
  }
});

// POST /square/characters/:id/toggle — 切换角色分享状态（需登录）
router.post('/characters/:id/toggle', requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const characterId = req.params.id;
  try {
    const result = await pool.query<{ shared: boolean }>(
      `UPDATE cloud_characters SET shared = NOT shared, updated_at = $1
       WHERE user_id = $2 AND id = $3
       RETURNING shared`,
      [Date.now(), userId, characterId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: '角色不存在（请先同步到云端）' });
      return;
    }
    res.json({ shared: result.rows[0].shared });
  } catch (err) {
    console.error('[square/characters/toggle]', err);
    res.status(500).json({ error: '切换分享状态失败' });
  }
});

// POST /square/characters/:id/favorite — 收藏/取消收藏（需登录）
router.post('/characters/:id/favorite', requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const characterId = req.params.id;
  try {
    const existing = await pool.query(
      'SELECT 1 FROM favorites WHERE user_id = $1 AND character_id = $2',
      [userId, characterId]
    );
    if (existing.rows.length > 0) {
      // 取消收藏
      await pool.query(
        'DELETE FROM favorites WHERE user_id = $1 AND character_id = $2',
        [userId, characterId]
      );
      await pool.query(
        'UPDATE cloud_characters SET heat = GREATEST(0, heat - 1) WHERE id = $1',
        [characterId]
      );
      res.json({ favorited: false });
    } else {
      // 添加收藏
      await pool.query(
        'INSERT INTO favorites (user_id, character_id, created_at) VALUES ($1, $2, $3)',
        [userId, characterId, Date.now()]
      );
      await pool.query(
        'UPDATE cloud_characters SET heat = heat + 1 WHERE id = $1',
        [characterId]
      );
      res.json({ favorited: true });
    }
  } catch (err) {
    console.error('[square/characters/favorite]', err);
    res.status(500).json({ error: '收藏操作失败' });
  }
});

// GET /square/favorites — 当前用户收藏的角色列表（需登录）
router.get('/favorites', requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  try {
    const result = await pool.query<SquareCharacterRow>(
      `SELECT cc.id, cc.name, cc.payload, cc.shared, cc.heat, cc.updated_at, cc.user_id, u.username
       FROM favorites f
       JOIN cloud_characters cc ON cc.id = f.character_id
       JOIN users u ON u.id = cc.user_id
       WHERE f.user_id = $1 AND cc.shared = TRUE
       ORDER BY f.created_at DESC`,
      [userId]
    );
    const characters = result.rows.map(r => {
      let portraitBase64: string | undefined;
      let portraitFullBase64: string | undefined;
      let personality: string | undefined;
      let background: string | undefined;
      let gender: string | undefined;
      let occupation: string | undefined;
      try {
        const p = JSON.parse(r.payload);
        portraitBase64 = p.portraitBase64;
        portraitFullBase64 = p.portraitFullBase64;
        personality = p.personality;
        background = p.background;
        gender = p.gender;
        occupation = p.occupation;
      } catch { /* ignore */ }
      return {
        id: r.id,
        name: r.name,
        userName: r.username,
        portraitBase64,
        portraitFullBase64,
        personality,
        background,
        gender,
        occupation,
        heat: r.heat || 0,
        isFavorited: true,
        updatedAt: r.updated_at,
      };
    });
    res.json({ characters });
  } catch (err) {
    console.error('[square/favorites]', err);
    res.status(500).json({ error: '读取收藏列表失败' });
  }
});

// ── Model Square ──

interface SquareModelRow {
  id: string;
  name: string;
  provider: string;
  base_url: string;
  model_id: string;
  context_window: number;
  shared: boolean;
  updated_at: number;
  user_id: number;
  username: string;
}

// GET /square/models — 广场模型列表（跨用户，仅 shared=true，无需登录）
router.get('/models', async (_req, res) => {
  try {
    const result = await pool.query<SquareModelRow>(
      `SELECT cm.id, cm.name, cm.provider, cm.base_url, cm.model_id,
              cm.context_window, cm.shared, cm.updated_at, cm.user_id, u.username
       FROM cloud_models cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.shared = TRUE
       ORDER BY cm.updated_at DESC
       LIMIT 100`
    );
    const models = result.rows.map(r => ({
      id: r.id,
      name: r.name,
      userName: r.username,
      provider: r.provider,
      baseUrl: r.base_url,
      modelId: r.model_id,
      contextWindow: r.context_window,
      shared: r.shared,
      updatedAt: r.updated_at,
    }));
    res.json({ models });
  } catch (err) {
    console.error('[square/models]', err);
    res.status(500).json({ error: '读取广场模型失败' });
  }
});

// POST /square/models/:id/toggle — 切换模型分享状态（需登录）
router.post('/models/:id/toggle', requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const modelId = req.params.id;
  try {
    const result = await pool.query<{ shared: boolean }>(
      `UPDATE cloud_models SET shared = NOT shared, updated_at = $1
       WHERE user_id = $2 AND id = $3
       RETURNING shared`,
      [Date.now(), userId, modelId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: '模型不存在（请先上传到云端）' });
      return;
    }
    res.json({ shared: result.rows[0].shared });
  } catch (err) {
    console.error('[square/models/toggle]', err);
    res.status(500).json({ error: '切换分享状态失败' });
  }
});

// PUT /square/models/:id — 上传/更新自己的模型到云端（需登录）
router.put('/models/:id', requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const modelId = req.params.id;
  const { name, provider, baseUrl, modelId: modelModelId, contextWindow } = req.body || {};

  if (typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'name 不能为空' });
    return;
  }
  if (typeof provider !== 'string' || provider.trim().length === 0) {
    res.status(400).json({ error: 'provider 不能为空' });
    return;
  }

  const updatedAt = Date.now();
  try {
    await pool.query(
      `INSERT INTO cloud_models (id, user_id, name, provider, base_url, model_id, context_window, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, id)
       DO UPDATE SET name = EXCLUDED.name, provider = EXCLUDED.provider,
                     base_url = EXCLUDED.base_url, model_id = EXCLUDED.model_id,
                     context_window = EXCLUDED.context_window, updated_at = EXCLUDED.updated_at`,
      [
        modelId,
        userId,
        name.trim(),
        provider.trim(),
        (baseUrl || '').trim(),
        (modelModelId || '').trim(),
        contextWindow || 64000,
        updatedAt,
      ]
    );
    res.json({ id: modelId, name: name.trim(), updatedAt });
  } catch (err) {
    console.error('[square/models put]', err);
    res.status(500).json({ error: '保存模型失败' });
  }
});

// DELETE /square/models/:id — 删除自己的云端模型（需登录）
router.delete('/models/:id', requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const modelId = req.params.id;
  try {
    const result = await pool.query(
      'DELETE FROM cloud_models WHERE user_id = $1 AND id = $2',
      [userId, modelId]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: '模型不存在' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[square/models delete]', err);
    res.status(500).json({ error: '删除模型失败' });
  }
});

// GET /square/models/mine — 列出自己的云端模型（需登录）
router.get('/models/mine', requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  try {
    const result = await pool.query<SquareModelRow>(
      `SELECT cm.id, cm.name, cm.provider, cm.base_url, cm.model_id,
              cm.context_window, cm.shared, cm.updated_at, cm.user_id, u.username
       FROM cloud_models cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.user_id = $1
       ORDER BY cm.updated_at DESC`,
      [userId]
    );
    const models = result.rows.map(r => ({
      id: r.id,
      name: r.name,
      userName: r.username,
      provider: r.provider,
      baseUrl: r.base_url,
      modelId: r.model_id,
      contextWindow: r.context_window,
      shared: r.shared,
      updatedAt: r.updated_at,
    }));
    res.json({ models });
  } catch (err) {
    console.error('[square/models/mine]', err);
    res.status(500).json({ error: '读取我的模型失败' });
  }
});

export default router;
