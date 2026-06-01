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
import { generateRandomTemplate, generateRandomCharacter } from '../services/roleplay-generate';
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
      const character = await createCharacterFromTemplate(templateId);
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
      const portraitPath = await copyPortraitFromFile(result.filePaths[0]);
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

  ipcMain.handle('roleplay:generateRandomTemplate', async (_event, keywords: string) => {
    try {
      const data = await generateRandomTemplate(keywords);
      if (!data) throw new Error('AI 生成模版失败，请重试');
      const id = `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const now = Date.now();
      const template = saveTemplate({
        id, name: data.name, gender: data.gender, occupation: data.occupation,
        personality: data.personality, background: data.background,
        body: data.body as any, openingStory: data.openingStory,
        statusFields: data.statusFields,
        createdAt: now, updatedAt: now,
      });
      return { success: true as const, template };
    } catch (err: unknown) {
      return { success: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('roleplay:generateRandomCharacter', async (_event, templateId: string) => {
    try {
      const template = listTemplates().find(t => t.id === templateId);
      if (!template) throw new Error('模版不存在');
      const data = await generateRandomCharacter(template as any);
      if (!data) throw new Error('AI 生成角色失败，请重试');
      const id = `char-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const now = Date.now();
      const character = saveCharacter({
        id, templateId,
        name: data.name, gender: data.gender || template.gender,
        occupation: data.occupation || template.occupation,
        personality: data.personality || template.personality,
        background: data.background || template.background,
        body: (data.body || template.body) as any,
        openingStory: template.openingStory,
        statusFieldEnabled: template.statusFields?.length
          ? Object.fromEntries(template.statusFields.map(f => [f.key, f.enabled !== false]))
          : {},
        createdAt: now, updatedAt: now,
      });
      return { success: true as const, character };
    } catch (err: unknown) {
      return { success: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
