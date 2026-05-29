import { ipcMain } from 'electron';
import {
  authHealthCheck,
  authLogin,
  authLogout,
  authRegister,
  authRestore,
  authUpdateProfile,
  getStoredApiBase,
  updateApiBase,
} from '../services/authClient';
import { DEFAULT_AUTH_API_BASE, isAuthApiBaseEditable } from '../security/authToken';

export function setupAuthHandlers() {
  ipcMain.handle('auth:getApiBase', async () => getStoredApiBase() || DEFAULT_AUTH_API_BASE);

  ipcMain.handle('auth:isApiBaseEditable', async () => isAuthApiBaseEditable());

  ipcMain.handle('auth:setApiBase', async (_event, baseUrl: string) => {
    if (!isAuthApiBaseEditable()) {
      return { success: false, error: '生产版本不可修改服务器地址' };
    }
    updateApiBase(typeof baseUrl === 'string' ? baseUrl : DEFAULT_AUTH_API_BASE);
    return { success: true };
  });

  ipcMain.handle('auth:login', async (_event, username: string, password: string) => {
    return authLogin(username, password);
  });

  ipcMain.handle('auth:register', async (_event, username: string, password: string, email?: string) => {
    return authRegister(username, password, typeof email === 'string' ? email : undefined);
  });

  ipcMain.handle('auth:restore', async () => authRestore());

  ipcMain.handle('auth:logout', async () => {
    await authLogout();
    return { success: true };
  });

  ipcMain.handle('auth:healthCheck', async (_event, baseUrl?: string) => {
    const ok = await authHealthCheck(baseUrl);
    return { ok };
  });

  ipcMain.handle('auth:updateProfile', async (_event, username: string) => {
    return authUpdateProfile(username);
  });
}
