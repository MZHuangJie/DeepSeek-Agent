import { app, BrowserWindow } from 'electron';
import path from 'path';
import { registerAllHandlers } from './ipc';
import { infoLog, errorLog } from './logger';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1e1e2e',
    titleBarStyle: 'hidden',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  mainWindow.setMenu(null);

  const devServerUrl = process.env.VITE_DEV_SERVER_URL || '';
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
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
  app.quit();
});
