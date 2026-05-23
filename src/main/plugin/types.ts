export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author?: string;

  // 注入点
  systemPrompt?: string;
  commands?: PluginCommand[];
  hooks?: PluginHooks;
  tools?: PluginToolDef[];
}

export interface PluginCommand {
  name: string;
  description: string;
  handler: 'prompt' | 'tool';
  template?: string;
  toolName?: string;
}

export interface PluginHooks {
  onInstall?: string;
  onUninstall?: string;
  onEnable?: string;
  onDisable?: string;
}

export interface PluginToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}
