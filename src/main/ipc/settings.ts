import { ipcMain } from 'electron';
import { getApiKey, saveApiKey } from '../security/keystore';
import { getSetting, setSetting } from '../db/settings';
import { saveSession, loadSessions, deleteSession } from '../db/sessions';
import { generateSessionTitle } from '../services/sessionTitle';

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

  ipcMain.handle('sessions:generateTitle', async (_event, payload: {
    userMessage: string;
    assistantPreview?: string;
    model?: string;
    baseUrl?: string;
    apiKey?: string;
  }) => {
    const apiKey = payload.apiKey || getApiKey();
    if (!apiKey) return { success: false as const, error: '未配置 API Key' };

    try {
      const title = await generateSessionTitle(
        apiKey,
        {
          model: payload.model || 'deepseek-chat',
          baseUrl: payload.baseUrl || 'https://api.deepseek.com',
        },
        payload.userMessage,
        payload.assistantPreview,
      );
      return { success: true as const, title };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false as const, error: message };
    }
  });
}
