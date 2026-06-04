import 'dotenv/config';
import path from 'path';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { initDb } from './db';
import authRouter from './routes/auth';
import syncRouter from './routes/sync';
import squareRouter from './routes/square';
import imagesRouter from './routes/images';

const BASE_PATH = '/ds';
const API_PREFIX = `${BASE_PATH}/api`;
const PORT = Number(process.env.PORT) || 8787;

const app = express();
app.use(helmet());
app.use(express.json({ limit: '50mb' }));
app.use('/ds/images', express.static(path.join(import.meta.dirname, 'public', 'images')));

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 16) {
  console.error('[server] FATAL: JWT_SECRET 未设置或过短（至少 16 字符），拒绝启动');
  process.exit(1);
}

// 全局限流
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试' },
});
app.use(globalLimiter);

// 敏感路由严格限流
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '操作过于频繁，请稍后再试' },
});

// 登录接口更严格限流
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '登录尝试过于频繁，请 15 分钟后再试' },
});

app.get(`${API_PREFIX}/health`, (_req, res) => {
  res.json({ ok: true });
});

app.use(`${API_PREFIX}/auth`, authRouter);
app.use(`${API_PREFIX}/images`, strictLimiter, imagesRouter);
app.use(`${API_PREFIX}/sync`, syncRouter);
app.use(`${API_PREFIX}/square`, squareRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

async function start() {
  try {
    await initDb();
    console.log('[server] 数据库已初始化');
    app.listen(PORT, () => {
      console.log(`[server] listening on http://127.0.0.1:${PORT}${API_PREFIX}`);
      console.log(`[server] health: http://127.0.0.1:${PORT}${API_PREFIX}/health`);
    });
  } catch (err) {
    console.error('[server] 启动失败:', err);
    process.exit(1);
  }
}

start();
