import { ipcMain, BrowserWindow } from 'electron';

export function setupWindowHandlers() {
  ipcMain.handle('window:minimize', async () => {
    const win = BrowserWindow.getFocusedWindow();
    win?.minimize();
  });

  ipcMain.handle('window:maximize', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });

  ipcMain.handle('window:close', async () => {
    const win = BrowserWindow.getFocusedWindow();
    win?.close();
  });
}
