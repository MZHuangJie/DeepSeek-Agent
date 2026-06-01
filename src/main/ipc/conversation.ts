import { ipcMain } from 'electron';
import { saveConversation, loadAllConversations, deleteConversation } from '../db/conversation';

export function setupConversationHandlers() {
  ipcMain.handle('conversations:save', async (_event, id: string, title: string, payload: string) => {
    saveConversation(id, title, payload);
    return { success: true };
  });

  ipcMain.handle('conversations:loadAll', async () => {
    return loadAllConversations();
  });

  ipcMain.handle('conversations:delete', async (_event, id: string) => {
    deleteConversation(id);
    return { success: true };
  });

  ipcMain.handle('conversations:getMigrated', async () => {
    const db = (await import('../db/connection')).getDatabase();
    try {
      const rows = db.all("SELECT value FROM settings WHERE key = '_migrated_v2'");
      return rows.length > 0;
    } catch {
      return false;
    }
  });

  ipcMain.handle('conversations:setMigrated', async () => {
    const db = (await import('../db/connection')).getDatabase();
    db.run(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('_migrated_v2', '1')"
    );
    return { success: true };
  });
}
