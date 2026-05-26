import fs from 'fs';
import path from 'path';

export const AGENT_IMAGES_DIR_NAME = '.deepseek-agent-images';

export function getAgentImagesDir(projectDir: string): string {
  const dir = path.join(projectDir, AGENT_IMAGES_DIR_NAME);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getPortraitFilePath(projectDir: string, ownerId: string, ext = '.png'): string {
  return path.join(getAgentImagesDir(projectDir), `portrait-${ownerId}${ext}`);
}

export function isAgentImagesPath(filePath: string, projectDir: string): boolean {
  const resolved = path.resolve(filePath);
  const dir = path.resolve(getAgentImagesDir(projectDir));
  return resolved === dir || resolved.startsWith(dir + path.sep);
}

export function resolveAgentImageReadPath(filePath: string, projectDir: string): string {
  if (!isAgentImagesPath(filePath, projectDir)) {
    throw new Error('图片路径无效');
  }
  return path.resolve(filePath);
}

export function toDisplayPath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

export function readAgentImageAsDataUrl(filePath: string, projectDir: string): string {
  const safePath = resolveAgentImageReadPath(filePath, projectDir);
  if (!fs.existsSync(safePath)) throw new Error('图片文件不存在');
  const buf = fs.readFileSync(safePath);
  const ext = path.extname(safePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp',
  };
  const mime = mimeMap[ext] || 'image/png';
  return `data:${mime};base64,${buf.toString('base64')}`;
}
