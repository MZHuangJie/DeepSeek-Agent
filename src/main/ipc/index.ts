import { ipcMain } from 'electron';
import { setupFileHandlers } from './files';
import { setupAgentHandlers } from './agent';
import { setupTerminalHandlers } from './terminal';
import { setupSettingsHandlers } from './settings';
import { setupWindowHandlers } from './window';
import { setupPluginHandlers } from './plugin';
import { setupBrowserHandlers } from './browser';

export function registerAllHandlers() {
  setupWindowHandlers();
  setupFileHandlers();
  setupAgentHandlers();
  setupTerminalHandlers();
  setupSettingsHandlers();
  setupPluginHandlers();
  setupBrowserHandlers();
}
