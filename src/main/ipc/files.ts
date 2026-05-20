import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';

export function setupFileHandlers() {
  ipcMain.handle('files:list', async (_event, dirPath: string) => {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.map(e => ({
      name: e.name,
      isDirectory: e.isDirectory(),
      path: path.join(dirPath, e.name),
    }));
  });

  ipcMain.handle('files:read', async (_event, filePath: string) => {
    return fs.readFileSync(filePath, 'utf-8');
  });

  ipcMain.handle('files:cwd', async () => {
    return process.cwd();
  });
}
