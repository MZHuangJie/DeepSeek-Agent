import { ipcMain } from 'electron';
import { getApiKey, saveApiKey } from '../security/keystore';
import { getSetting, setSetting } from '../db/settings';
import { saveSession, loadSessions, deleteSession } from '../db/sessions';

export function setupSettingsHandlers() {
  ipcMain.handle('settings:get', async (_event, key: string) => getSetting(key));
  ipcMain.handle('settings:set', async (_event, key: string, value: string) => {
    setSetting(key, value);
    return { success: true };
  });
  ipcMain.handle('settings:getApiKey', async () => getApiKey());
  ipcMain.handle('settings:setApiKey', async (_event, key: string) => {
    saveApiKey(key);
    return { success: true };
  });

  ipcMain.handle('sessions:save', async (_event, id: string, title: string, messages: string) => {
    saveSession(id, title, messages);
    return { success: true };
  });
  ipcMain.handle('sessions:loadAll', async () => loadSessions());
  ipcMain.handle('sessions:delete', async (_event, id: string) => {
    deleteSession(id);
    return { success: true };
  });
}
