import { ipcMain } from 'electron';
import {
  addMarketplace, removeMarketplace, listMarketplaces,
  logPluginError, getPluginErrors, clearPluginErrors,
} from '../db/plugins';
import { discoverFromRepo, downloadSkillContent } from '../plugin/registry';
import { pluginManager } from '../plugin/manager';

function parseFrontmatter(content: string): {
  name: string; description: string; version?: string;
  commands?: Array<{ name: string; description: string; handler: 'prompt' | 'tool' }>;
  hooks?: { onInstall?: string; onUninstall?: string };
  body: string;
} {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return { name: '', description: '', body: content };
  const yaml = match[1];
  const name = (yaml.match(/^name:\s*(.+)$/m) || [])[1]?.trim() || '';
  const description = (yaml.match(/^description:\s*(.+)$/m) || [])[1]?.trim() || '';
  const version = (yaml.match(/^version:\s*(.+)$/m) || [])[1]?.trim();

  const commands: Array<{ name: string; description: string; handler: 'prompt' | 'tool' }> = [];
  const cmdBlock = yaml.match(/^commands:\s*\n([\s\S]*?)(?=\n\S|$)/m);
  if (cmdBlock) {
    for (const line of cmdBlock[1].split('\n')) {
      const entry = line.match(/^\s*-\s*\{?\s*name:\s*["']?(\S+?)["']?\s*,\s*description:\s*["']?(.+?)["']?\s*(?:,\s*handler:\s*(\S+))?\s*\}?/);
      if (entry) {
        commands.push({ name: entry[1], description: entry[2], handler: (entry[3] as 'prompt' | 'tool') || 'prompt' });
      }
    }
  }

  let onInstall: string | undefined;
  let onUninstall: string | undefined;
  const oi = yaml.match(/^onInstall:\s*["']?(.+?)["']?\s*$/m);
  if (oi) onInstall = oi[1];
  const ou = yaml.match(/^onUninstall:\s*["']?(.+?)["']?\s*$/m);
  if (ou) onUninstall = ou[1];

  const body = content.slice((match.index ?? 0) + match[0].length).trim();

  return {
    name, description, version,
    commands: commands.length > 0 ? commands : undefined,
    hooks: (onInstall || onUninstall) ? { onInstall, onUninstall } : undefined,
    body,
  };
}

export function setupPluginHandlers() {
  // Load plugins on startup
  pluginManager.loadAll();

  // --- Marketplaces ---
  ipcMain.handle('marketplace:add', async (_event, url: string) => {
    const id = `mp-${Date.now()}`;
    let name = url;
    const match = url.match(/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/);
    if (match) name = match[1];
    else if (!url.includes('://')) name = url;
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
    const allPlugins: Array<{ name: string; description: string; source: string; downloadUrl: string }> = [];
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
      const fm = parseFrontmatter(content);

      await pluginManager.install(
        fm.name || meta.name,
        fm.description || meta.name,
        fm.body,
        meta.source,
        {
          version: fm.version,
          commands: fm.commands,
          hooks: fm.hooks,
        },
      );

      return { success: true };
    } catch (err: any) {
      const msg = err.message || String(err);
      logPluginError(meta.name, meta.source, msg);
      return { success: false, error: msg };
    }
  });

  // --- Plugin Uninstall ---
  ipcMain.handle('plugin:uninstall', async (_event, name: string) => {
    await pluginManager.uninstall(name);
    return { success: true };
  });

  // --- Plugin List ---
  ipcMain.handle('plugin:list-installed', async () => {
    const plugins = pluginManager.listPlugins();
    return plugins.map(p => ({
      name: p.name,
      description: p.description,
      system_prompt: p.systemPrompt,
      source: p.source,
      installed_at: p.installedAt,
      version: p.version,
      commands: p.commands,
      hooks: p.hooks,
    }));
  });

  // --- Errors ---
  ipcMain.handle('plugin:get-errors', async () => {
    return getPluginErrors();
  });

  ipcMain.handle('plugin:clear-errors', async () => {
    clearPluginErrors();
    return { success: true };
  });

  // --- Get active plugin prompts (for system prompt assembly) ---
  ipcMain.handle('plugin:get-system-prompts', async () => {
    return pluginManager.getSystemPrompts();
  });
}
