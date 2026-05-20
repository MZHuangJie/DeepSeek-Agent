import { ipcMain } from 'electron';
import { setupFileHandlers } from './files';
import { setupAgentHandlers } from './agent';
import { setupTerminalHandlers } from './terminal';
import { setupSettingsHandlers } from './settings';
import { setupWindowHandlers } from './window';

export function registerAllHandlers() {
  setupWindowHandlers();
  setupFileHandlers();
  setupAgentHandlers();
  setupTerminalHandlers();
  setupSettingsHandlers();
}
