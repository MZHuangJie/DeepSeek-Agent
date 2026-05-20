import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { getSetting, setSetting } from '../db/settings';

let currentWorkspace = process.cwd();

export function getCurrentWorkspace(): string {
  return currentWorkspace;
}

function safeResolve(baseDir: string, targetPath: string): string {
  const resolved = path.resolve(baseDir, targetPath);
  const normalizedBase = path.resolve(baseDir) + path.sep;
  if (!resolved.startsWith(normalizedBase) && resolved !== path.resolve(baseDir)) {
    throw new Error(`路径越界: ${targetPath} 不在项目目录内`);
  }
  return resolved;
}

function getRecentWorkspaces(): string[] {
  try {
    const raw = getSetting('recent_workspaces');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addToRecentWorkspaces(workspacePath: string) {
  try {
    let recent = getRecentWorkspaces();
    recent = recent.filter(p => p !== workspacePath);
    recent.unshift(workspacePath);
    recent = recent.slice(0, 10);
    setSetting('recent_workspaces', JSON.stringify(recent));
  } catch (err) {
    console.error('Failed to save recent workspaces:', err);
  }
}

export function setupFileHandlers() {
  ipcMain.handle('files:list', async (_event, dirPath: string) => {
    const safePath = safeResolve(currentWorkspace, dirPath);
    const entries = fs.readdirSync(safePath, { withFileTypes: true });
    return entries.map(e => ({
      name: e.name,
      isDirectory: e.isDirectory(),
      path: path.join(safePath, e.name),
    }));
  });

  ipcMain.handle('files:read', async (_event, filePath: string) => {
    const safePath = safeResolve(currentWorkspace, filePath);
    return fs.readFileSync(safePath, 'utf-8');
  });

  ipcMain.handle('files:cwd', async () => {
    return currentWorkspace;
  });

  ipcMain.handle('files:select-workspace', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      title: '选择工作区文件夹',
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    const selectedPath = result.filePaths[0];
    currentWorkspace = selectedPath;
    addToRecentWorkspaces(selectedPath);
    return selectedPath;
  });

  ipcMain.handle('files:set-workspace', async (_event, workspacePath: string) => {
    if (fs.existsSync(workspacePath)) {
      currentWorkspace = workspacePath;
      addToRecentWorkspaces(workspacePath);
      return true;
    }
    return false;
  });

  ipcMain.handle('files:get-recent', async () => {
    return getRecentWorkspaces();
  });
}
