import { ipcMain } from 'electron';
import { getCurrentWorkspace } from './files';
import {
  checkoutGitBranch,
  cleanUntrackedGit,
  commitGit,
  discardAllGit,
  discardGitPaths,
  fetchGit,
  getGitDiff,
  getGitLog,
  getGitStatus,
  initGitRepo,
  listGitBranches,
  listGitStashes,
  publishGitBranch,
  pullGit,
  pushGit,
  stageAllGit,
  stageGitPaths,
  stashPopGit,
  stashPushGit,
  syncGit,
  unstageAllGit,
  unstageGitPaths,
} from '../services/git';

function wrap<T>(fn: () => Promise<T>) {
  return fn()
    .then(data => ({ success: true as const, data }))
    .catch((err: unknown) => ({
      success: false as const,
      error: err instanceof Error ? err.message : String(err),
    }));
}

export function setupGitHandlers() {
  const cwd = () => getCurrentWorkspace();

  ipcMain.handle('git:status', async () => {
    const res = await wrap(() => getGitStatus(cwd()));
    return res.success ? { success: true as const, status: res.data } : res;
  });

  ipcMain.handle('git:branches', async () => {
    const res = await wrap(() => listGitBranches(cwd()));
    return res.success ? { success: true as const, branches: res.data } : res;
  });

  ipcMain.handle('git:checkout', async (_event, payload: { branch: string; create?: boolean }) => {
    const res = await wrap(() => checkoutGitBranch(cwd(), payload.branch, payload.create));
    return res.success ? { success: true as const } : res;
  });

  ipcMain.handle('git:init', async () => {
    const res = await wrap(() => initGitRepo(cwd()));
    return res.success ? { success: true as const } : res;
  });

  ipcMain.handle('git:diff', async (_event, payload?: { path?: string; staged?: boolean }) => {
    const res = await wrap(() => getGitDiff(cwd(), payload?.path, payload?.staged));
    return res.success ? { success: true as const, diff: res.data } : res;
  });

  ipcMain.handle('git:stage', async (_event, paths: string[]) => {
    const res = await wrap(() => stageGitPaths(cwd(), paths));
    return res.success ? { success: true as const } : res;
  });

  ipcMain.handle('git:stage-all', async () => {
    const res = await wrap(() => stageAllGit(cwd()));
    return res.success ? { success: true as const } : res;
  });

  ipcMain.handle('git:unstage', async (_event, paths: string[]) => {
    const res = await wrap(() => unstageGitPaths(cwd(), paths));
    return res.success ? { success: true as const } : res;
  });

  ipcMain.handle('git:unstage-all', async () => {
    const res = await wrap(() => unstageAllGit(cwd()));
    return res.success ? { success: true as const } : res;
  });

  ipcMain.handle('git:discard', async (_event, paths: string[]) => {
    const res = await wrap(() => discardGitPaths(cwd(), paths));
    return res.success ? { success: true as const } : res;
  });

  ipcMain.handle('git:discard-all', async () => {
    const res = await wrap(() => discardAllGit(cwd()));
    return res.success ? { success: true as const } : res;
  });

  ipcMain.handle('git:clean-untracked', async () => {
    const res = await wrap(() => cleanUntrackedGit(cwd()));
    return res.success ? { success: true as const, output: res.data } : res;
  });

  ipcMain.handle('git:commit', async (_event, message: string) => {
    const res = await wrap(() => commitGit(cwd(), message));
    return res.success ? { success: true as const, hash: res.data } : res;
  });

  ipcMain.handle('git:fetch', async () => {
    const res = await wrap(() => fetchGit(cwd()));
    return res.success ? { success: true as const, output: res.data } : res;
  });

  ipcMain.handle('git:pull', async () => {
    const res = await wrap(() => pullGit(cwd()));
    return res.success ? { success: true as const, output: res.data } : res;
  });

  ipcMain.handle('git:push', async () => {
    const res = await wrap(() => pushGit(cwd()));
    return res.success ? { success: true as const, output: res.data } : res;
  });

  ipcMain.handle('git:publish', async () => {
    const res = await wrap(() => publishGitBranch(cwd()));
    return res.success ? { success: true as const, output: res.data } : res;
  });

  ipcMain.handle('git:sync', async () => {
    const res = await wrap(() => syncGit(cwd()));
    return res.success ? { success: true as const, result: res.data } : res;
  });

  ipcMain.handle('git:log', async (_event, limit?: number) => {
    const res = await wrap(() => getGitLog(cwd(), limit));
    return res.success ? { success: true as const, entries: res.data } : res;
  });

  ipcMain.handle('git:stash-list', async () => {
    const res = await wrap(() => listGitStashes(cwd()));
    return res.success ? { success: true as const, stashes: res.data } : res;
  });

  ipcMain.handle('git:stash-push', async (_event, message?: string) => {
    const res = await wrap(() => stashPushGit(cwd(), message));
    return res.success ? { success: true as const, output: res.data } : res;
  });

  ipcMain.handle('git:stash-pop', async () => {
    const res = await wrap(() => stashPopGit(cwd()));
    return res.success ? { success: true as const, output: res.data } : res;
  });
}
