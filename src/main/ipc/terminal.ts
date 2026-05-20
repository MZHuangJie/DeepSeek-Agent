import { ipcMain, BrowserWindow } from 'electron';
import { spawn, IPty } from 'node-pty';
import { getCurrentWorkspace } from './files';

const terminals = new Map<string, IPty>();

export function setupTerminalHandlers() {
  ipcMain.handle('terminal:create', async (_event, requestedShell?: string) => {
    const id = `term-${Date.now()}`;
    let shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    if (requestedShell) {
      if (requestedShell === 'powershell') {
        shell = 'powershell.exe';
      } else if (requestedShell === 'cmd') {
        shell = 'cmd.exe';
      } else if (requestedShell === 'bash') {
        shell = 'bash';
      } else if (requestedShell === 'zsh') {
        shell = 'zsh';
      } else {
        shell = requestedShell;
      }
    }
    const pty = spawn(
      shell,
      [],
      { name: 'xterm-color', cols: 80, rows: 24, cwd: getCurrentWorkspace() }
    );
    terminals.set(id, pty);
    pty.onData((data: string) => {
      const win = BrowserWindow.getAllWindows()[0];
      win?.webContents.send('terminal:data', { id, output: data });
    });
    pty.onExit(({ exitCode, signal }) => {
      terminals.delete(id);
      const win = BrowserWindow.getAllWindows()[0];
      win?.webContents.send('terminal:exit', { id, exitCode, signal });
    });
    return id;
  });

  ipcMain.handle('terminal:write', async (_event, id: string, data: string) => {
    terminals.get(id)?.write(data);
  });

  ipcMain.handle('terminal:resize', async (_event, id: string, cols: number, rows: number) => {
    terminals.get(id)?.resize(cols, rows);
  });

  ipcMain.handle('terminal:destroy', async (_event, id: string) => {
    terminals.get(id)?.kill();
    terminals.delete(id);
  });
}
