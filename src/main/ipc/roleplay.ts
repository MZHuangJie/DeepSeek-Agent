import { ipcMain, dialog, BrowserWindow } from 'electron';
import {
  listTemplates,
  saveTemplate,
  deleteTemplate,
  listCharacters,
  saveCharacter,
  deleteCharacter,
  getActiveCharacterId,
  setActiveCharacterId,
  createCharacterFromTemplate,
  copyPortraitFromFile,
  getCharacter,
} from '../services/roleplay-storage';
import { generateCharacterPortrait } from '../services/roleplay-portrait';
import { portraitInfo, portraitError } from '../services/portrait-log';

export function setupRoleplayHandlers() {
  ipcMain.handle('roleplay:listTemplates', async () => {
    try {
      return { success: true as const, templates: listTemplates() };
    } catch (err: unknown) {
      return { success: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('roleplay:saveTemplate', async (_event, payload) => {
    try {
      const template = saveTemplate(payload);
      return { success: true as const, template };
    } catch (err: unknown) {
      return { success: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('roleplay:deleteTemplate', async (_event, id: string) => {
    try {
      deleteTemplate(id);
      return { success: true as const };
    } catch (err: unknown) {
      return { success: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('roleplay:listCharacters', async () => {
    try {
      return {
        success: true as const,
        characters: listCharacters(),
        activeCharacterId: getActiveCharacterId(),
      };
    } catch (err: unknown) {
      return { success: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('roleplay:saveCharacter', async (_event, payload) => {
    try {
      const character = saveCharacter(payload);
      return { success: true as const, character };
    } catch (err: unknown) {
      return { success: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('roleplay:deleteCharacter', async (_event, id: string) => {
    try {
      deleteCharacter(id);
      return { success: true as const };
    } catch (err: unknown) {
      return { success: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('roleplay:createFromTemplate', async (_event, templateId: string) => {
    try {
      const character = createCharacterFromTemplate(templateId);
      return { success: true as const, character };
    } catch (err: unknown) {
      return { success: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('roleplay:setActiveCharacter', async (_event, id: string | null) => {
    try {
      if (id && !getCharacter(id)) throw new Error('角色不存在');
      setActiveCharacterId(id);
      return { success: true as const };
    } catch (err: unknown) {
      return { success: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('roleplay:pickPortrait', async (event, ownerId: string, copy = true) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false as const, error: '窗口不可用' };
    const result = await dialog.showOpenDialog(win, {
      title: '选择角色立绘',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
    });
    if (result.canceled || !result.filePaths[0]) {
      return { success: false as const, error: '已取消' };
    }
    try {
      const portraitPath = copy
        ? copyPortraitFromFile(result.filePaths[0], ownerId)
        : result.filePaths[0];
      return { success: true as const, portraitPath };
    } catch (err: unknown) {
      return { success: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('roleplay:generatePortrait', async (event, ownerId: string, payload) => {
    portraitInfo('ipc-generate-start', {
      ownerId,
      characterName: payload?.name,
    });
    try {
      const sendProgress = (stage: 'prompt' | 'image') => {
        portraitInfo('ipc-progress', { ownerId, stage });
        if (!event.sender.isDestroyed()) {
          event.sender.send('roleplay:portrait-progress', { stage });
        }
      };
      const { portraitPath, prompt, dataUrl } = await generateCharacterPortrait(
        ownerId,
        payload,
        sendProgress,
      );
      portraitInfo('ipc-generate-success', {
        ownerId,
        portraitPath,
        promptPreview: prompt.slice(0, 120),
      });
      return { success: true as const, portraitPath, prompt, dataUrl };
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      portraitError('ipc-generate-failed', { ownerId, error });
      return { success: false as const, error };
    }
  });
}
