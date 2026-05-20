import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';

function safeResolve(baseDir: string, targetPath: string): string {
  const resolved = path.resolve(baseDir, targetPath);
  const normalizedBase = path.resolve(baseDir) + path.sep;
  if (!resolved.startsWith(normalizedBase) && resolved !== path.resolve(baseDir)) {
    throw new Error(`路径越界: ${targetPath} 不在项目目录内`);
  }
  return resolved;
}

export function setupFileHandlers() {
  ipcMain.handle('files:list', async (_event, dirPath: string) => {
    const safePath = safeResolve(process.cwd(), dirPath);
    const entries = fs.readdirSync(safePath, { withFileTypes: true });
    return entries.map(e => ({
      name: e.name,
      isDirectory: e.isDirectory(),
      path: path.join(safePath, e.name),
    }));
  });

  ipcMain.handle('files:read', async (_event, filePath: string) => {
    const safePath = safeResolve(process.cwd(), filePath);
    return fs.readFileSync(safePath, 'utf-8');
  });

  ipcMain.handle('files:cwd', async () => {
    return process.cwd();
  });
}
