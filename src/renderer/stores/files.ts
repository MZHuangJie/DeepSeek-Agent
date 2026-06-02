import { create } from 'zustand';

export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

export type TabKind = 'file' | 'diff';

export interface OpenTab {
  path: string;
  name: string;
  kind: TabKind;
  content?: string;
  originalContent?: string;
  relPath?: string;
  staged?: boolean;
  diffOriginal?: string;
  diffModified?: string;
  originalLabel?: string;
  modifiedLabel?: string;
  language?: string;
}

function languageFromName(name: string): string {
  if (name.endsWith('.ts') || name.endsWith('.tsx')) return 'typescript';
  if (name.endsWith('.js') || name.endsWith('.jsx')) return 'javascript';
  if (name.endsWith('.py')) return 'python';
  if (name.endsWith('.json')) return 'json';
  if (name.endsWith('.md')) return 'markdown';
  if (name.endsWith('.css')) return 'css';
  if (name.endsWith('.html')) return 'html';
  if (name.endsWith('.yml') || name.endsWith('.yaml')) return 'yaml';
  return 'text';
}

export function makeDiffTabId(relPath: string, staged: boolean): string {
  return `git-diff://${relPath}#${staged ? 'staged' : 'working'}`;
}

interface FilesState {
  tree: FileNode[];
  openTabs: OpenTab[];
  activeTab: string | null;
  currentWorkspace: string | null;
  recentWorkspaces: string[];
  setTree: (tree: FileNode[]) => void;
  openFile: (path: string, name: string) => void;
  openDiffTab: (relPath: string, staged: boolean) => Promise<{ success: boolean; error?: string }>;
  refreshOpenDiffTabs: () => Promise<void>;
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
  openFileDialog: () => Promise<void>;
  removeRecentWorkspace: (p: string) => Promise<void>;
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
        set({ openTabs: [...openTabs, { path, name, kind: 'file', content, originalContent: content }] });
      } catch {
        set({ openTabs: [...openTabs, { path, name, kind: 'file' }] });
      }
    }
    set({ activeTab: path });
  },
  openDiffTab: async (relPath, staged) => {
    const tabId = makeDiffTabId(relPath, staged);
    const fileName = relPath.split(/[/\\]/).pop() || relPath;
    const name = `${fileName} (${staged ? 'Staged' : 'Working Tree'})`;
    const res = await window.api.git.diffContent({ path: relPath, staged });
    if (!res.success) {
      return { success: false, error: res.error };
    }

    const tab: OpenTab = {
      path: tabId,
      name,
      kind: 'diff',
      relPath,
      staged,
      diffOriginal: res.content.original,
      diffModified: res.content.modified,
      originalLabel: res.content.originalLabel,
      modifiedLabel: res.content.modifiedLabel,
      language: languageFromName(fileName),
    };

    const { openTabs } = get();
    const exists = openTabs.some(t => t.path === tabId);
    set({
      openTabs: exists ? openTabs.map(t => (t.path === tabId ? tab : t)) : [...openTabs, tab],
      activeTab: tabId,
    });
    return { success: true };
  },
  refreshOpenDiffTabs: async () => {
    const { openTabs } = get();
    const diffTabs = openTabs.filter(t => t.kind === 'diff' && t.relPath != null && t.staged != null);
    if (diffTabs.length === 0) return;

    const updated = await Promise.all(diffTabs.map(async tab => {
      const res = await window.api.git.diffContent({ path: tab.relPath!, staged: tab.staged! });
      if (!res.success) return tab;
      return {
        ...tab,
        diffOriginal: res.content.original,
        diffModified: res.content.modified,
        originalLabel: res.content.originalLabel,
        modifiedLabel: res.content.modifiedLabel,
      };
    }));

    const byId = new Map(updated.map(t => [t.path, t]));
    set({
      openTabs: openTabs.map(t => byId.get(t.path) ?? t),
    });
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
      openTabs: s.openTabs.map(t => t.path === path && t.kind === 'file' ? { ...t, content } : t),
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
    const tab = get().openTabs.find(t => t.path === path && t.kind === 'file');
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
        set({ openTabs: [], activeTab: null, tree: [] });
        await get().loadWorkspace();
      }
    } catch (err) {
      console.error('Failed to select workspace:', err);
    }
  },
  openFileDialog: async () => {
    try {
      const result = await window.api.files.openFile();
      if (result?.openFile) {
        set({ openTabs: [], activeTab: null, tree: [] });
        await get().loadWorkspace();
        const name = result.openFile.split(/[\\/]/).pop() || result.openFile;
        get().openFile(result.openFile, name);
      }
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  },
  removeRecentWorkspace: async (p) => {
    const updated = await window.api.files.removeRecentWorkspace(p);
    set({ recentWorkspaces: updated });
  },
}));
