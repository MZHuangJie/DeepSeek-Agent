import { ipcMain } from 'electron';
import {
  cloudListSessions,
  cloudGetSession,
  cloudPushSession,
  cloudDeleteSession,
  cloudListCharacters,
  cloudGetCharacter,
  cloudPushCharacter,
  cloudDeleteCharacter,
  cloudListTemplates,
  cloudGetTemplate,
  cloudPushTemplate,
  cloudDeleteTemplate,
  squareListCharacters,
  squareListModels,
  squareToggleCharacterShared,
  squareToggleModelShared,
  squarePushModel,
  squareDeleteModel,
  squareListMyModels,
} from '../services/syncClient';

export function setupSyncHandlers() {
  ipcMain.handle('sync:listSessions', async () => {
    return cloudListSessions();
  });

  ipcMain.handle('sync:getSession', async (_event, sessionId: string) => {
    return cloudGetSession(sessionId);
  });

  ipcMain.handle('sync:pushSession', async (_event, sessionId: string, title: string, payload: string) => {
    return cloudPushSession(sessionId, title, payload);
  });

  ipcMain.handle('sync:deleteSession', async (_event, sessionId: string) => {
    return cloudDeleteSession(sessionId);
  });

  ipcMain.handle('sync:listCharacters', async () => {
    return cloudListCharacters();
  });

  ipcMain.handle('sync:getCharacter', async (_event, characterId: string) => {
    return cloudGetCharacter(characterId);
  });

  ipcMain.handle('sync:pushCharacter', async (_event, characterId: string, name: string, payload: string) => {
    return cloudPushCharacter(characterId, name, payload);
  });

  ipcMain.handle('sync:deleteCharacter', async (_event, characterId: string) => {
    return cloudDeleteCharacter(characterId);
  });

  ipcMain.handle('sync:listTemplates', async () => {
    return cloudListTemplates();
  });

  ipcMain.handle('sync:getTemplate', async (_event, templateId: string) => {
    return cloudGetTemplate(templateId);
  });

  ipcMain.handle('sync:pushTemplate', async (_event, templateId: string, name: string, payload: string) => {
    return cloudPushTemplate(templateId, name, payload);
  });

  ipcMain.handle('sync:deleteTemplate', async (_event, templateId: string) => {
    return cloudDeleteTemplate(templateId);
  });

  // ── Square / 角色广场 ──
  ipcMain.handle('square:listCharacters', async () => {
    return squareListCharacters();
  });

  ipcMain.handle('square:listModels', async () => {
    return squareListModels();
  });

  ipcMain.handle('square:toggleCharacterShared', async (_event, characterId: string) => {
    return squareToggleCharacterShared(characterId);
  });

  ipcMain.handle('square:toggleModelShared', async (_event, modelId: string) => {
    return squareToggleModelShared(modelId);
  });

  ipcMain.handle('square:pushModel', async (_event, payload: Record<string, unknown>) => {
    return squarePushModel({
      id: payload.id as string,
      name: payload.name as string,
      provider: payload.provider as string,
      baseUrl: payload.baseUrl as string,
      modelId: payload.modelId as string,
      contextWindow: payload.contextWindow as number | undefined,
    });
  });

  ipcMain.handle('square:deleteModel', async (_event, modelId: string) => {
    return squareDeleteModel(modelId);
  });

  ipcMain.handle('square:listMyModels', async () => {
    return squareListMyModels();
  });
}
