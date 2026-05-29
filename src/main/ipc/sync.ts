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
}
