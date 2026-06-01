// src/main/ipc/groupChat.ts
import { ipcMain, BrowserWindow } from 'electron';
import { runGroupLoop } from '../agent/groupDirector';
import type { Conversation, GroupChunk } from '../../common/conversation';
import { getApiKey } from '../security/keystore';

const activeControllers = new Map<string, AbortController>();

export function setupGroupChatHandlers() {
  ipcMain.handle('group-chat:send', async (event, conversationJson: string, userMessage: string) => {
    const conv: Conversation = JSON.parse(conversationJson);
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('未配置 API Key');

    const existing = activeControllers.get(conv.id);
    if (existing) existing.abort();

    const controller = new AbortController();
    activeControllers.set(conv.id, controller);

    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) throw new Error('找不到窗口');

    const directorModelConfig = conv.driver.directorModel || {
      model: 'deepseek-chat',
      baseUrl: 'https://api.deepseek.com/v1',
    };

    const onChunk = (data: GroupChunk) => {
      if (win.isDestroyed()) return;
      win.webContents.send('group-chat:chunk', conv.id, data);
    };

    try {
      await runGroupLoop(conv, userMessage, onChunk, controller.signal, apiKey, directorModelConfig);
    } catch (err) {
      onChunk({ type: 'error', message: err instanceof Error ? err.message : '群聊异常' });
    } finally {
      activeControllers.delete(conv.id);
    }
  });

  ipcMain.handle('group-chat:cancel', async (_event, convId: string) => {
    const controller = activeControllers.get(convId);
    if (controller) {
      controller.abort();
      activeControllers.delete(convId);
    }
    return { success: true };
  });
}
