import { ipcMain, dialog, BrowserWindow, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import { getSetting, setSetting } from '../db/settings';
import { syncTerminalCwd } from '../ipc/terminal';
import { safeResolve, checkSensitiveFile } from '../agent/tools/security';

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
    checkSensitiveFile(safePath, 'read');
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
    syncTerminalCwd(selectedPath);
    startWatching(win);
    return selectedPath;
  });

  ipcMain.handle('files:set-workspace', async (event, workspacePath: string) => {
    if (fs.existsSync(workspacePath)) {
      currentWorkspace = workspacePath;
      addToRecentWorkspaces(workspacePath);
      syncTerminalCwd(workspacePath);
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) startWatching(win);
      return true;
    }
    return false;
  });

  ipcMain.handle('files:get-recent', async () => {
    return getRecentWorkspaces();
  });

  ipcMain.handle('files:remove-recent', async (_event, workspacePath: string) => {
    let recent = getRecentWorkspaces();
    recent = recent.filter(p => p !== workspacePath);
    setSetting('recent_workspaces', JSON.stringify(recent));
    return recent;
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
    checkSensitiveFile(safePath, 'write');
    fs.writeFileSync(safePath, content, 'utf-8');
    return { success: true };
  });

  ipcMain.handle('files:rename', async (_event, oldPath: string, newPath: string) => {
    const safeOld = safeResolve(currentWorkspace, oldPath);
    const safeNew = safeResolve(currentWorkspace, newPath);
    if (!fs.existsSync(safeOld)) {
      throw new Error(`路径不存在: ${oldPath}`);
    }
    if (fs.existsSync(safeNew)) {
      throw new Error(`目标已存在: ${newPath}`);
    }
    fs.renameSync(safeOld, safeNew);
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

  ipcMain.handle('files:show-in-explorer', async (_event, filePath: string) => {
    const safePath = safeResolve(currentWorkspace, filePath);
    if (fs.existsSync(safePath)) {
      shell.showItemInFolder(safePath);
    }
    return { success: true };
  });

  ipcMain.handle('files:save-clipboard-image', async (_event, base64: string, mimeType: string) => {
    const clipboardDir = path.join(currentWorkspace, '.mycli', 'clipboard');
    fs.mkdirSync(clipboardDir, { recursive: true });
    const ext = mimeType.split('/')[1] || 'png';
    const filename = `paste-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const filePath = path.join(clipboardDir, filename);
    const buffer = Buffer.from(base64, 'base64');
    fs.writeFileSync(filePath, buffer);
    return filePath;
  });

  ipcMain.handle('files:saveBase64Image', async (_event, base64DataUrl: string, targetPath: string) => {
    const safePath = safeResolve(currentWorkspace, targetPath);
    const match = base64DataUrl.match(/^data:(.+?);base64,(.+)$/);
    if (!match) throw new Error('Invalid base64 data URL');
    const [, mimeType, base64] = match;
    const ext = (mimeType.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '');
    const destPath = safePath.endsWith(`.${ext}`) ? safePath : `${safePath}.${ext}`;
    const dir = path.dirname(destPath);
    fs.mkdirSync(dir, { recursive: true });
    const buffer = Buffer.from(base64, 'base64');
    fs.writeFileSync(destPath, buffer);
    return destPath;
  });

  const activeContentSearches = new Map<string, AbortController>();

  ipcMain.handle(
    'files:search-content',
    async (event, payload: { searchId: string; query: string; filter: 'all' | 'code' | 'document'; filePaths?: string[] }) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const controller = new AbortController();
      activeContentSearches.set(payload.searchId, controller);

      try {
        const { searchContentStreaming } = await import('../services/contentSearch');
        await searchContentStreaming({
          workspace: currentWorkspace,
          query: payload.query,
          filter: payload.filter,
          filePaths: payload.filePaths,
          signal: controller.signal,
          onBatch: (matches, progress) => {
            if (win && !win.isDestroyed()) {
              win.webContents.send('files:search-content-batch', {
                searchId: payload.searchId,
                matches,
                progress,
              });
            }
          },
        });
      } catch (err) {
        console.error('[files:search-content] failed:', err);
      } finally {
        activeContentSearches.delete(payload.searchId);
        if (win && !win.isDestroyed()) {
          win.webContents.send('files:search-content-done', { searchId: payload.searchId });
        }
      }
    },
  );

  ipcMain.handle('files:search-content-cancel', async (_event, searchId: string) => {
    activeContentSearches.get(searchId)?.abort();
    activeContentSearches.delete(searchId);
    return { success: true };
  });
}
