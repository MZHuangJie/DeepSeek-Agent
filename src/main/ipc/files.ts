import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { getSetting, setSetting } from '../db/settings';

let currentWorkspace = process.cwd();
let fileWatcher: fs.FSWatcher | null = null;
let watchDebounce: ReturnType<typeof setTimeout> | null = null;

function startWatching(win: BrowserWindow) {
  stopWatching();
  try {
    fileWatcher = fs.watch(currentWorkspace, { recursive: true }, () => {
      if (watchDebounce) clearTimeout(watchDebounce);
      watchDebounce = setTimeout(() => {
        if (!win.isDestroyed()) {
          win.webContents.send('files:tree-changed');
        }
      }, 300);
    });
  } catch {
    // fs.watch 在某些系统上可能不可用，静默忽略
  }
}

function stopWatching() {
  if (watchDebounce) { clearTimeout(watchDebounce); watchDebounce = null; }
  if (fileWatcher) { fileWatcher.close(); fileWatcher = null; }
}

export function getCurrentWorkspace(): string {
  return currentWorkspace;
}

function safeResolve(baseDir: string, targetPath: string): string {
  const resolved = path.resolve(baseDir, targetPath);
  const normalizedBase = path.resolve(baseDir) + path.sep;
  if (!resolved.startsWith(normalizedBase) && resolved !== path.resolve(baseDir)) {
    throw new Error(`路径越界: ${targetPath} 不在项目目录内`);
  }
  try {
    const realPath = fs.realpathSync(resolved);
    const realBase = fs.realpathSync(baseDir);
    if (!realPath.startsWith(realBase + path.sep) && realPath !== realBase) {
      throw new Error(`路径越界: ${targetPath} 不在项目目录内`);
    }
    return realPath;
  } catch (e: any) {
    if (e.message?.includes('路径越界')) throw e;
    return resolved;
  }
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

  ipcMain.handle('files:readBinary', async (_event, filePath: string) => {
    const safePath = safeResolve(currentWorkspace, filePath);
    const buf = fs.readFileSync(safePath);
    const ext = path.extname(safePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp', '.ico': 'image/x-icon',
    };
    const mime = mimeMap[ext] || 'application/octet-stream';
    return `data:${mime};base64,${buf.toString('base64')}`;
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
    startWatching(win);
    return selectedPath;
  });

  ipcMain.handle('files:set-workspace', async (event, workspacePath: string) => {
    if (fs.existsSync(workspacePath)) {
      currentWorkspace = workspacePath;
      addToRecentWorkspaces(workspacePath);
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) startWatching(win);
      return true;
    }
    return false;
  });

  ipcMain.handle('files:get-recent', async () => {
    return getRecentWorkspaces();
  });

  ipcMain.handle('files:create-file', async (_event, filePath: string) => {
    const safePath = safeResolve(currentWorkspace, filePath);
    if (fs.existsSync(safePath)) {
      throw new Error(`文件已存在: ${filePath}`);
    }
    fs.writeFileSync(safePath, '');
    return { success: true };
  });

  ipcMain.handle('files:create-directory', async (_event, dirPath: string) => {
    const safePath = safeResolve(currentWorkspace, dirPath);
    fs.mkdirSync(safePath, { recursive: true });
    return { success: true };
  });

  ipcMain.handle('files:write', async (_event, filePath: string, content: string) => {
    const safePath = safeResolve(currentWorkspace, filePath);
    fs.writeFileSync(safePath, content, 'utf-8');
    return { success: true };
  });

  ipcMain.handle('files:delete', async (_event, targetPath: string) => {
    const safePath = safeResolve(currentWorkspace, targetPath);
    if (!fs.existsSync(safePath)) {
      throw new Error(`路径不存在: ${targetPath}`);
    }
    const stat = fs.statSync(safePath);
    if (stat.isDirectory()) {
      fs.rmSync(safePath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(safePath);
    }
    return { success: true };
  });
}
