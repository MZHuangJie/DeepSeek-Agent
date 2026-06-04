import { Router } from 'express';
import { logError } from '../middleware/logger';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { createUser, findUserById, findUserByUsername, findUserByEmail, updateUser } from '../db';
import { requireAuth, signToken, getTokenExpiry, validateCredentials } from '../middleware/requireAuth';
import { revokeToken } from '../middleware/tokenBlacklist';

const router = Router();

// 登录接口严格限流（15 分钟最多 10 次）
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '登录尝试过于频繁，请 15 分钟后再试' },
});

function publicUser(user: { id: number; username: string; email: string | null; avatar: string | null }) {
  return { id: user.id, username: user.username, email: user.email, avatar: user.avatar };
}

router.post('/register', async (req, res) => {
  if (process.env.ALLOW_REGISTER === 'false') {
    res.status(403).json({ error: '注册已关闭' });
    return;
  }
  const { username, password, email } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: '请提供 username 与 password' });
    return;
  }
  const validationError = validateCredentials(username, password);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }
  const existing = await findUserByUsername(username);
  if (existing) {
    res.status(409).json({ error: '用户名已存在' });
    return;
  }
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser(username, passwordHash, typeof email === 'string' ? email : undefined);
    const token = signToken({ userId: user.id, username: user.username });
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    logError('', err);
    res.status(500).json({ error: '注册失败' });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: '请提供 username 与 password' });
    return;
  }
  let user = await findUserByUsername(username);
  if (!user && username.includes('@')) {
    user = await findUserByEmail(username);
  }
  const ok = user ? await bcrypt.compare(password, user.password_hash) : false;
  if (!user || !ok) {
    // 登录失败延迟：减缓暴力破解
    await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }
  const token = signToken({ userId: user.id, username: user.username });
  res.json({ token, user: publicUser(user) });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await findUserById(req.auth!.userId);
  if (!user) {
    res.status(401).json({ error: '用户不存在' });
    return;
  }
  res.json({ user: publicUser(user) });
});

router.post('/logout', requireAuth, (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const expiry = getTokenExpiry(token);
  const jti = (jwt.decode(token) as { jti?: string } | null)?.jti;
  if (jti && expiry) {
    revokeToken(jti, req.auth!.userId, expiry);
  }
  res.json({ success: true });
});

router.post('/update-profile', requireAuth, async (req, res) => {
  const { username, email, avatar } = req.body || {};

  const updates: Partial<{ username: string; email: string; avatar: string }> = {};

  if (typeof username === 'string' && username.trim()) {
    const name = username.trim();
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(name)) {
      res.status(400).json({ error: '用户名需为 3–32 位字母、数字或下划线' });
      return;
    }
    const existing = await findUserByUsername(name);
    if (existing && existing.id !== req.auth!.userId) {
      res.status(409).json({ error: '用户名已存在' });
      return;
    }
    updates.username = name;
  }

  if (typeof email === 'string') {
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      res.status(400).json({ error: '邮箱格式不正确' });
      return;
    }
    updates.email = email.trim();
  }

  if (typeof avatar === 'string') {
    updates.avatar = avatar.trim() || null;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: '没有要更新的内容' });
    return;
  }

  const user = await updateUser(req.auth!.userId, updates);
  if (!user) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }
  const token = signToken({ userId: user.id, username: user.username });
  res.json({ token, user: publicUser(user) });
});

export default router;
