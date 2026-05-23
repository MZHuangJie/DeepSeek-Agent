import { create } from 'zustand';

export interface PluginMeta {
  name: string;
  description: string;
  source: string;
  downloadUrl: string;
}

export interface InstalledPlugin {
  name: string;
  description: string | null;
  system_prompt: string;
  source: string | null;
  installed_at: number;
  version?: string;
  commands?: Array<{ name: string; description: string; handler: 'prompt' | 'tool' }>;
  hooks?: { onInstall?: string; onUninstall?: string };
}

export interface MarketplaceEntry {
  id: string;
  name: string;
  url: string;
  type: string;
  added_at: number;
}

export interface PluginErrorEntry {
  id: number;
  plugin_name: string | null;
  marketplace: string | null;
  error: string;
  timestamp: number;
}

interface PluginState {
  activeTab: 'discover' | 'installed' | 'marketplaces' | 'errors';
  marketplaces: MarketplaceEntry[];
  discoveredPlugins: PluginMeta[];
  installedPlugins: InstalledPlugin[];
  errors: PluginErrorEntry[];
  discoverLoading: boolean;
  installLoading: Record<string, boolean>;

  setActiveTab: (tab: PluginState['activeTab']) => void;
  loadMarketplaces: () => Promise<void>;
  addMarketplace: (url: string) => Promise<void>;
  removeMarketplace: (id: string) => Promise<void>;
  discoverPlugins: () => Promise<void>;
  installPlugin: (meta: PluginMeta) => Promise<{ success: boolean; error?: string }>;
  uninstallPlugin: (name: string) => Promise<void>;
  loadInstalled: () => Promise<void>;
  loadErrors: () => Promise<void>;
  clearErrors: () => Promise<void>;
}

export const usePluginStore = create<PluginState>((set, get) => ({
  activeTab: 'discover',
  marketplaces: [],
  discoveredPlugins: [],
  installedPlugins: [],
  errors: [],
  discoverLoading: false,
  installLoading: {},

  setActiveTab: (tab) => set({ activeTab: tab }),

  loadMarketplaces: async () => {
    const list = await window.api.marketplace.list();
    set({ marketplaces: list });
  },

  addMarketplace: async (url) => {
    await window.api.marketplace.add(url);
    await get().loadMarketplaces();
  },

  removeMarketplace: async (id) => {
    await window.api.marketplace.remove(id);
    set(s => ({ marketplaces: s.marketplaces.filter(m => m.id !== id) }));
  },

  discoverPlugins: async () => {
    set({ discoverLoading: true });
    try {
      const result = await window.api.plugins.discover();
      set({ discoveredPlugins: result.plugins || [], discoverLoading: false });
      if (result.errors?.length > 0) {
        set({ errors: result.errors.map((e: any, i: number) => ({
          id: Date.now() + i,
          plugin_name: e.pluginName || null,
          marketplace: e.marketplace || null,
          error: e.error,
          timestamp: Date.now(),
        })) });
      }
    } catch (err: any) {
      set({ discoverLoading: false, errors: [{ id: Date.now(), plugin_name: null, marketplace: null, error: err.message || String(err), timestamp: Date.now() }] });
    }
  },

  installPlugin: async (meta) => {
    set(s => ({ installLoading: { ...s.installLoading, [meta.name]: true } }));
    try {
      const result = await window.api.plugins.install(meta);
      set(s => ({ installLoading: { ...s.installLoading, [meta.name]: false } }));
      if (result.success) {
        await get().loadInstalled();
      } else if (result.error) {
        await get().loadErrors();
      }
      return result;
    } catch (err: any) {
      set(s => ({ installLoading: { ...s.installLoading, [meta.name]: false } }));
      return { success: false, error: err.message || String(err) };
    }
  },

  uninstallPlugin: async (name) => {
    await window.api.plugins.uninstall(name);
    await get().loadInstalled();
  },

  loadInstalled: async () => {
    const list = await window.api.plugins.listInstalled();
    set({ installedPlugins: list });
  },

  loadErrors: async () => {
    const list = await window.api.plugins.getErrors();
    set({ errors: list });
  },

  clearErrors: async () => {
    await window.api.plugins.clearErrors();
    set({ errors: [] });
  },
}));
