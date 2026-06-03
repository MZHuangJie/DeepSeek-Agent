import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthPayload {
  userId: number;
  username: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET 未设置');
  return secret;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '30d' });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    res.status(401).json({ error: '未授权' });
    return;
  }
  try {
    const decoded = jwt.verify(match[1], getJwtSecret()) as AuthPayload;
    req.auth = { userId: decoded.userId, username: decoded.username };
    next();
  } catch {
    res.status(401).json({ error: '无效或过期的 token' });
  }
}

export function validateCredentials(username: string, password: string): string | null {
  const name = username.trim();
  if (!/^[a-zA-Z0-9_]{3,32}$/.test(name)) {
    return '用户名需为 3–32 位字母、数字或下划线';
  }
  if (password.length < 6) {
    return '密码至少 6 位';
  }
  return null;
}
