import { ipcMain, BrowserWindow } from 'electron';
import path from 'path';

const browserWindows = new Map<number, BrowserWindow>();

export function setupBrowserHandlers() {
  ipcMain.handle('browser:open', async (_event, url?: string) => {
    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      title: 'MyCLI 浏览器',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const id = win.id;
    browserWindows.set(id, win);

    const targetUrl = url || 'https://www.google.com';
    win.loadURL(targetUrl);

    // 注入导航控制脚本
    win.webContents.on('did-finish-load', () => {
      win.webContents.executeJavaScript(`
        (function() {
          if (document.getElementById('mycli-nav-bar')) return;
          const bar = document.createElement('div');
          bar.id = 'mycli-nav-bar';
          bar.innerHTML = '<div style="display:flex;gap:6px;padding:6px 10px;background:#1e1e1e;border-bottom:1px solid #333;align-items:center">' +
            '<button onclick="history.back()" style="background:#333;border:none;color:#ccc;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px">◀ 后退</button>' +
            '<button onclick="history.forward()" style="background:#333;border:none;color:#ccc;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px">前进 ▶</button>' +
            '<button onclick="location.reload()" style="background:#333;border:none;color:#ccc;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px">↻ 刷新</button>' +
            '<input id="mycli-url" value="' + location.href + '" style="flex:1;background:#2d2d2d;border:1px solid #444;color:#ccc;padding:4px 8px;border-radius:4px;font-size:12px;outline:none" onkeydown="if(event.key===\\'Enter\\')location.href=this.value">' +
            '</div>';
          document.body.prepend(bar);
        })()
      `);
    });

    win.on('closed', () => {
      browserWindows.delete(id);
    });

    return { id, url: targetUrl };
  });

  ipcMain.handle('browser:navigate', async (_event, id: number, url: string) => {
    const win = browserWindows.get(id);
    if (win && !win.isDestroyed()) {
      win.loadURL(url);
      return true;
    }
    return false;
  });
}
