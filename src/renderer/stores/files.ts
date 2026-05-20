import { create } from 'zustand';

export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

interface OpenTab {
  path: string;
  name: string;
  content?: string;
  originalContent?: string;
}

interface FilesState {
  tree: FileNode[];
  openTabs: OpenTab[];
  activeTab: string | null;
  currentWorkspace: string | null;
  recentWorkspaces: string[];
  setTree: (tree: FileNode[]) => void;
  openFile: (path: string, name: string) => void;
  closeTab: (path: string) => void;
  closeTabsToRight: (path: string) => void;
  closeOtherTabs: (path: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (path: string) => void;
  updateTabContent: (path: string, content: string) => void;
  saveFile: (path: string) => Promise<void>;
  loadWorkspace: () => Promise<void>;
  openWorkspace: (workspacePath: string) => Promise<void>;
  selectAndOpenWorkspace: () => Promise<void>;
}

export const useFilesStore = create<FilesState>((set, get) => ({
  tree: [],
  openTabs: [],
  activeTab: null,
  currentWorkspace: null,
  recentWorkspaces: [],
  setTree: (tree) => set({ tree }),
  openFile: async (path, name) => {
    const { openTabs } = get();
    const existing = openTabs.find(t => t.path === path);
    if (!existing) {
      try {
        const content = await window.api.files.read(path);
        set({ openTabs: [...openTabs, { path, name, content, originalContent: content }] });
      } catch {
        set({ openTabs: [...openTabs, { path, name }] });
      }
    }
    set({ activeTab: path });
  },
  closeTab: (path) => {
    const { openTabs, activeTab } = get();
    const idx = openTabs.findIndex(t => t.path === path);
    const newTabs = openTabs.filter(t => t.path !== path);
    const newActive = activeTab === path
      ? newTabs[Math.min(idx, newTabs.length - 1)]?.path ?? null
      : activeTab;
    set({ openTabs: newTabs, activeTab: newActive });
  },
  closeTabsToRight: (path) => {
    const { openTabs, activeTab } = get();
    const idx = openTabs.findIndex(t => t.path === path);
    const newTabs = openTabs.slice(0, idx + 1);
    const newActive = newTabs.find(t => t.path === activeTab) ? activeTab : path;
    set({ openTabs: newTabs, activeTab: newActive });
  },
  closeOtherTabs: (path) => {
    const tab = get().openTabs.find(t => t.path === path);
    if (tab) {
      set({ openTabs: [tab], activeTab: path });
    }
  },
  closeAllTabs: () => {
    set({ openTabs: [], activeTab: null });
  },
  setActiveTab: (path) => set({ activeTab: path }),
  updateTabContent: (path, content) => {
    set(s => ({
      openTabs: s.openTabs.map(t => t.path === path ? { ...t, content } : t)
    }));
  },
  loadWorkspace: async () => {
    try {
      const cwd = await window.api.files.cwd();
      const recents = await window.api.files.getRecentWorkspaces();
      set({ currentWorkspace: cwd, recentWorkspaces: recents });
    } catch (err) {
      console.error('Failed to load workspace:', err);
    }
  },
  openWorkspace: async (workspacePath) => {
    try {
      const success = await window.api.files.setWorkspace(workspacePath);
      if (success) {
        // Clear previous editor tabs and tree, and reload
        set({ openTabs: [], activeTab: null, tree: [] });
        await get().loadWorkspace();
      }
    } catch (err) {
      console.error('Failed to open workspace:', err);
    }
  },
  saveFile: async (path) => {
    const tab = get().openTabs.find(t => t.path === path);
    if (!tab || tab.content === undefined) return;
    await window.api.files.write(path, tab.content);
    set(s => ({
      openTabs: s.openTabs.map(t =>
        t.path === path ? { ...t, originalContent: t.content } : t
      ),
    }));
  },

  selectAndOpenWorkspace: async () => {
    try {
      const selected = await window.api.files.selectWorkspace();
      if (selected) {
        // Clear previous tabs and tree, and reload
        set({ openTabs: [], activeTab: null, tree: [] });
        await get().loadWorkspace();
      }
    } catch (err) {
      console.error('Failed to select workspace:', err);
    }
  },
}));
