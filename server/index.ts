import 'dotenv/config';
import path from 'path';
import express from 'express';
import { initDb } from './db';
import authRouter from './routes/auth';
import syncRouter from './routes/sync';
import squareRouter from './routes/square';
import imagesRouter from './routes/images';

const BASE_PATH = '/ds';
const API_PREFIX = `${BASE_PATH}/api`;
const PORT = Number(process.env.PORT) || 8787;

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/ds/images', express.static(path.join(import.meta.dirname, 'public', 'images')));

const jwtSecret = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
if (jwtSecret.length < 16 || jwtSecret.includes('change-me')) {
  console.warn('[server] 警告: JWT_SECRET 过弱或为默认值，生产环境请务必修改');
}

app.get(`${API_PREFIX}/health`, (_req, res) => {
  res.json({ ok: true });
});

app.use(`${API_PREFIX}/auth`, authRouter);
app.use(`${API_PREFIX}/sync`, syncRouter);
app.use(`${API_PREFIX}/square`, squareRouter);
app.use(`${API_PREFIX}/images`, imagesRouter);

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
