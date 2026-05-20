import { ipcMain } from 'electron';
import {
  addMarketplace, removeMarketplace, listMarketplaces,
  installPlugin, uninstallPlugin, listPlugins,
  logPluginError, getPluginErrors, clearPluginErrors,
} from '../db/plugins';
import { discoverFromRepo, downloadSkillContent, PluginMeta } from '../plugin/registry';

export function setupPluginHandlers() {
  // --- Marketplaces ---
  ipcMain.handle('marketplace:add', async (_event, url: string) => {
    const id = `mp-${Date.now()}`;
    // 从 URL 提取名称
    let name = url;
    const match = url.match(/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/);
    if (match) {
      name = match[1];
    } else if (!url.includes('://')) {
      name = url;
    }
    addMarketplace(id, name, url);
    return { success: true, id };
  });

  ipcMain.handle('marketplace:remove', async (_event, id: string) => {
    removeMarketplace(id);
    return { success: true };
  });

  ipcMain.handle('marketplace:list', async () => {
    return listMarketplaces();
  });

  // --- Plugin Discovery ---
  ipcMain.handle('plugin:discover', async () => {
    const marketplaces = listMarketplaces();
    const allPlugins: PluginMeta[] = [];
    const errors: Array<{ pluginName: string; marketplace: string; error: string }> = [];

    for (const mp of marketplaces) {
      try {
        const plugins = await discoverFromRepo(mp.url);
        for (const p of plugins) {
          if (!allPlugins.find(x => x.name === p.name)) {
            allPlugins.push(p);
          }
        }
      } catch (err: any) {
        const msg = err.message || String(err);
        logPluginError(null, mp.name, msg);
        errors.push({ pluginName: '', marketplace: mp.name, error: msg });
      }
    }

    return { plugins: allPlugins, errors };
  });

  // --- Plugin Install ---
  ipcMain.handle('plugin:install', async (_event, meta: { name: string; source: string; downloadUrl: string }) => {
    try {
      const content = await downloadSkillContent(meta.downloadUrl);
      const frontmatter = parseFrontmatter(content);
      installPlugin(
        meta.name,
        frontmatter.description || meta.name,
        content,
        meta.source,
      );
      return { success: true };
    } catch (err: any) {
      const msg = err.message || String(err);
      logPluginError(meta.name, meta.source, msg);
      return { success: false, error: msg };
    }
  });

  ipcMain.handle('plugin:uninstall', async (_event, name: string) => {
    uninstallPlugin(name);
    return { success: true };
  });

  ipcMain.handle('plugin:list-installed', async () => {
    return listPlugins();
  });

  ipcMain.handle('plugin:get-errors', async () => {
    return getPluginErrors();
  });

  ipcMain.handle('plugin:clear-errors', async () => {
    clearPluginErrors();
    return { success: true };
  });
}

function parseFrontmatter(content: string): { name: string; description: string } {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return { name: '', description: '' };
  const yaml = match[1];
  const name = (yaml.match(/^name:\s*(.+)$/m) || [])[1]?.trim() || '';
  const description = (yaml.match(/^description:\s*(.+)$/m) || [])[1]?.trim() || '';
  return { name, description };
}
