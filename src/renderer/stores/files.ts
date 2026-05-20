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
}

interface FilesState {
  tree: FileNode[];
  openTabs: OpenTab[];
  activeTab: string | null;
  setTree: (tree: FileNode[]) => void;
  openFile: (path: string, name: string) => void;
  closeTab: (path: string) => void;
  setActiveTab: (path: string) => void;
  updateTabContent: (path: string, content: string) => void;
}

export const useFilesStore = create<FilesState>((set, get) => ({
  tree: [],
  openTabs: [],
  activeTab: null,
  setTree: (tree) => set({ tree }),
  openFile: async (path, name) => {
    const { openTabs } = get();
    if (!openTabs.find(t => t.path === path)) {
      try {
        const content = await window.api.files.read(path);
        set({ openTabs: [...openTabs, { path, name, content }] });
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
  setActiveTab: (path) => set({ activeTab: path }),
  updateTabContent: (path, content) => {
    set(s => ({
      openTabs: s.openTabs.map(t => t.path === path ? { ...t, content } : t)
    }));
  },
}));
