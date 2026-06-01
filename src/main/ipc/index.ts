import { ipcMain } from 'electron';
import { setupFileHandlers } from './files';
import { setupAgentHandlers } from './agent';
import { setupTerminalHandlers } from './terminal';
import { setupSettingsHandlers } from './settings';
import { setupWindowHandlers } from './window';
import { setupPluginHandlers } from './plugin';
import { setupBrowserHandlers } from './browser';
import { setupGitHandlers } from './git';
import { setupRoleplayHandlers } from './roleplay';
import { setupAuthHandlers } from './auth';
import { setupSyncHandlers } from './sync';
import { setupConversationHandlers } from './conversation';
import { setupGroupChatHandlers } from './groupChat';

export function registerAllHandlers() {
  setupWindowHandlers();
  setupFileHandlers();
  setupAgentHandlers();
  setupTerminalHandlers();
  setupSettingsHandlers();
  setupAuthHandlers();
  setupSyncHandlers();
  setupPluginHandlers();
  setupBrowserHandlers();
  setupGitHandlers();
  setupRoleplayHandlers();
  setupConversationHandlers();
  setupGroupChatHandlers();
}
