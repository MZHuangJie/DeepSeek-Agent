import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { createUser, findUserById, findUserByUsername, updateUser } from '../db';
import { requireAuth, signToken, validateCredentials } from '../middleware/requireAuth';

const router = Router();

function publicUser(user: { id: number; username: string }) {
  return { id: user.id, username: user.username };
}

router.post('/register', async (req, res) => {
  if (process.env.ALLOW_REGISTER === 'false') {
    res.status(403).json({ error: '注册已关闭' });
    return;
  }
  const { username, password } = req.body || {};
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
    const user = await createUser(username, passwordHash);
    const token = signToken({ userId: user.id, username: user.username });
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('[auth/register]', err);
    res.status(500).json({ error: '注册失败' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: '请提供 username 与 password' });
    return;
  }
  const user = await findUserByUsername(username);
  if (!user) {
    res.status(401).json({ error: '用户不存在' });
    return;
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    res.status(401).json({ error: '密码错误' });
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

router.post('/logout', requireAuth, (_req, res) => {
  res.json({ success: true });
});

router.post('/update-profile', requireAuth, async (req, res) => {
  const { username } = req.body || {};
  if (typeof username !== 'string' || !username.trim()) {
    res.status(400).json({ error: '请提供 username' });
    return;
  }
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
  const user = await updateUser(req.auth!.userId, { username: name });
  if (!user) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }
  const token = signToken({ userId: user.id, username: user.username });
  res.json({ token, user: publicUser(user) });
});

export default router;
