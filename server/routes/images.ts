import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

const PUBLIC_DIR = path.join(import.meta.dirname, '..', 'public', 'images');

fs.mkdirSync(PUBLIC_DIR, { recursive: true });

router.post('/upload', requireAuth, async (req, res) => {
  try {
    const { image } = req.body as { image?: string };
    if (!image || typeof image !== 'string') {
      res.status(400).json({ error: '缺少 image 字段' });
      return;
    }

    const match = image.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      res.status(400).json({ error: '图片格式无效，需要 base64 data URL' });
      return;
    }

    const mime = match[1];
    const b64 = match[2];
    const buf = Buffer.from(b64, 'base64');

    if (buf.length > 50 * 1024 * 1024) {
      res.status(413).json({ error: '图片不能超过 50MB' });
      return;
    }

    const ext = mimeToExt(mime);
    if (!ext) {
      res.status(400).json({ error: '不支持的图片格式' });
      return;
    }
    const name = `${crypto.randomUUID()}${ext}`;
    const dest = path.join(PUBLIC_DIR, name);
    await fs.promises.writeFile(dest, buf);

    const url = `/ds/images/${name}`;
    console.log(`[images] uploaded ${buf.length} bytes -> ${url}`);
    res.json({ url });
  } catch (err) {
    console.error('[images] upload error:', err);
    res.status(500).json({ error: '上传失败' });
  }
});

function mimeToExt(mime: string): string {
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('gif')) return '.gif';
  if (mime.includes('svg')) return '.svg';
  return ''; // 未知 MIME 拒绝上传
}

export default router;
