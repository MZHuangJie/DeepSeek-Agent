import { ipcMain } from 'electron';
import { getCurrentWorkspace } from './files';
import {
  commitGit,
  discardGitPaths,
  getGitDiff,
  getGitLog,
  getGitStatus,
  stageGitPaths,
  unstageGitPaths,
} from '../services/git';

export function setupGitHandlers() {
  ipcMain.handle('git:status', async () => {
    try {
      const status = await getGitStatus(getCurrentWorkspace());
      return { success: true as const, status };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false as const, error: message };
    }
  });

  ipcMain.handle('git:diff', async (_event, payload?: { path?: string; staged?: boolean }) => {
    try {
      const diff = await getGitDiff(getCurrentWorkspace(), payload?.path, payload?.staged);
      return { success: true as const, diff };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false as const, error: message };
    }
  });

  ipcMain.handle('git:stage', async (_event, paths: string[]) => {
    try {
      await stageGitPaths(getCurrentWorkspace(), paths);
      return { success: true as const };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false as const, error: message };
    }
  });

  ipcMain.handle('git:unstage', async (_event, paths: string[]) => {
    try {
      await unstageGitPaths(getCurrentWorkspace(), paths);
      return { success: true as const };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false as const, error: message };
    }
  });

  ipcMain.handle('git:discard', async (_event, paths: string[]) => {
    try {
      await discardGitPaths(getCurrentWorkspace(), paths);
      return { success: true as const };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false as const, error: message };
    }
  });

  ipcMain.handle('git:commit', async (_event, message: string) => {
    try {
      const hash = await commitGit(getCurrentWorkspace(), message);
      return { success: true as const, hash };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false as const, error: message };
    }
  });

  ipcMain.handle('git:log', async (_event, limit?: number) => {
    try {
      const entries = await getGitLog(getCurrentWorkspace(), limit);
      return { success: true as const, entries };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false as const, error: message };
    }
  });
}
