import {
  installPlugin as dbInstall,
  uninstallPlugin as dbUninstall,
  listPlugins as dbList,
  getPlugin as dbGet,
  logPluginError,
} from '../db/plugins';
import { executePluginHook } from './sandbox';
import { infoLog, errorLog } from '../logger';

export interface PluginInstance {
  name: string;
  description: string | null;
  systemPrompt: string;
  source: string | null;
  installedAt: number;
  version?: string;
  commands?: Array<{ name: string; description: string; handler: 'prompt' | 'tool' }>;
  hooks?: { onInstall?: string; onUninstall?: string };
  enabled: boolean;
}

class PluginManager {
  private plugins: Map<string, PluginInstance> = new Map();
  private loaded = false;

  async loadAll(): Promise<void> {
    if (this.loaded) return;
    const rows = dbList();
    for (const row of rows) {
      let extra: Record<string, unknown> = {};
      try { extra = row.extra_data ? JSON.parse(row.extra_data) : {}; } catch {}

      this.plugins.set(row.name, {
        name: row.name,
        description: row.description,
        systemPrompt: row.system_prompt,
        source: row.source,
        installedAt: row.installed_at,
        version: extra.version as string | undefined,
        commands: extra.commands as PluginInstance['commands'],
        hooks: extra.hooks as PluginInstance['hooks'],
        enabled: true,
      });
    }
    this.loaded = true;
    infoLog('plugin', 'plugins-loaded', { count: this.plugins.size });
  }

  async install(
    name: string,
    description: string | null,
    systemPrompt: string,
    source: string | null,
    meta?: { version?: string; commands?: PluginInstance['commands']; hooks?: PluginInstance['hooks'] }
  ): Promise<void> {
    // Run onInstall hook if defined
    if (meta?.hooks?.onInstall) {
      try {
        const result = await executePluginHook(name, meta.hooks.onInstall);
        if (result.exitCode !== 0) {
          errorLog('plugin', 'onInstall-hook-failed', { plugin: name, stderr: result.stderr, exitCode: result.exitCode });
        }
      } catch (err: any) {
        errorLog('plugin', 'onInstall-hook-error', { plugin: name, error: err.message });
        throw new Error(`插件 "${name}" 安装钩子执行失败: ${err.message}`);
      }
    }

    const extraData = JSON.stringify({
      version: meta?.version,
      commands: meta?.commands,
      hooks: meta?.hooks,
    });

    dbInstall(name, description, systemPrompt, source, extraData);

    this.plugins.set(name, {
      name,
      description,
      systemPrompt,
      source,
      installedAt: Date.now(),
      version: meta?.version,
      commands: meta?.commands,
      hooks: meta?.hooks,
      enabled: true,
    });

    infoLog('plugin', 'plugin-installed', { plugin: name });
  }

  async uninstall(name: string): Promise<void> {
    const plugin = this.plugins.get(name);

    // Run onUninstall hook if defined
    if (plugin?.hooks?.onUninstall) {
      try {
        await executePluginHook(name, plugin.hooks.onUninstall);
      } catch (err: any) {
        // onUninstall failures are logged but don't block uninstall
        errorLog('plugin', 'onUninstall-hook-error', { plugin: name, error: err.message });
      }
    }

    dbUninstall(name);
    this.plugins.delete(name);
    infoLog('plugin', 'plugin-uninstalled', { plugin: name });
  }

  getPlugin(name: string): PluginInstance | undefined {
    return this.plugins.get(name);
  }

  listPlugins(): PluginInstance[] {
    return Array.from(this.plugins.values());
  }

  getSystemPrompts(): string {
    const prompts: string[] = [];
    for (const p of this.plugins.values()) {
      if (p.enabled && p.systemPrompt) {
        prompts.push(`## 插件: ${p.name}\n${p.systemPrompt}`);
      }
    }
    return prompts.join('\n\n');
  }

  /**
   * Get additional tools registered by plugins.
   * These are non-AI tools that plugins register for direct execution.
   */
  getPluginTools(): Array<{ name: string; description: string; parameters: Record<string, unknown> }> {
    return [];
  }

  /** Reload from database (useful after DB changes from elsewhere) */
  async reload(): Promise<void> {
    this.plugins.clear();
    this.loaded = false;
    await this.loadAll();
  }
}

export const pluginManager = new PluginManager();
