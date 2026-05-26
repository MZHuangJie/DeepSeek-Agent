import { app, BrowserWindow } from 'electron';
import path from 'path';
import { registerAllHandlers } from './ipc';
import { infoLog, errorLog } from './logger';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const preloadPath = path.join(__dirname, '../preload/index.js');
  const rendererPath = path.join(__dirname, '../renderer/index.html');
  infoLog('app', 'creating-window', { preload: preloadPath, renderer: rendererPath, __dirname });

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1e1e2e',
    titleBarStyle: 'hidden',
    frame: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  mainWindow.setMenu(null);

  // 监听加载失败
  mainWindow.webContents.on('did-fail-load', (_event, code, desc, url) => {
    errorLog('app', 'load-failed', { code, desc, url });
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL || '';
  if (devServerUrl) {
    infoLog('app', 'load-dev-url', { url: devServerUrl });
    mainWindow.loadURL(devServerUrl);
  } else {
    infoLog('app', 'load-file', { path: rendererPath });
    mainWindow.loadFile(rendererPath).catch(err => {
      errorLog('app', 'load-file-error', { error: err.message, path: rendererPath });
    });
  }
}

app.whenReady().then(() => {
  infoLog('app', 'startup', { electron: process.versions.electron, node: process.versions.node, platform: process.platform });
  registerAllHandlers();
  createWindow();
  infoLog('app', 'window-created');
});

app.on('window-all-closed', () => {
  infoLog('app', 'shutdown');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
