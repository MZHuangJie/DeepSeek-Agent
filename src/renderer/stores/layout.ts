import { create } from 'zustand';

type NumberOrFn = number | ((prev: number) => number);

interface LayoutState {
  sidebarWidth: number;
  agentPanelWidth: number;
  terminalHeight: number;
  chatPanelWidth: number;
  bottomPanel: 'terminal' | 'problems' | 'output' | 'debug';
  bottomExpanded: boolean;
  bottomClosed: boolean;
  setSidebarWidth: (w: NumberOrFn) => void;
  setAgentPanelWidth: (w: NumberOrFn) => void;
  setTerminalHeight: (h: NumberOrFn) => void;
  setChatPanelWidth: (w: NumberOrFn) => void;
  setBottomPanel: (p: 'terminal' | 'problems' | 'output' | 'debug') => void;
  setBottomExpanded: (v: boolean | ((prev: boolean) => boolean)) => void;
  setBottomClosed: (v: boolean | ((prev: boolean) => boolean)) => void;
  toggleBottomExpanded: () => void;
}

function resolve<T>(val: T | ((prev: T) => T), prev: T): T {
  return typeof val === 'function' ? (val as (prev: T) => T)(prev) : val;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  sidebarWidth: 240,
  agentPanelWidth: 320,
  terminalHeight: 180,
  chatPanelWidth: 380,
  bottomPanel: 'terminal',
  bottomExpanded: true,
  bottomClosed: true,
  setSidebarWidth: (w) => set(s => ({ sidebarWidth: resolve(w, s.sidebarWidth) })),
  setAgentPanelWidth: (w) => set(s => ({ agentPanelWidth: resolve(w, s.agentPanelWidth) })),
  setTerminalHeight: (h) => set(s => ({ terminalHeight: resolve(h, s.terminalHeight) })),
  setChatPanelWidth: (w) => set(s => ({ chatPanelWidth: resolve(w, s.chatPanelWidth) })),
  setBottomPanel: (p) => set({ bottomPanel: p }),
  setBottomExpanded: (v) => set(s => ({ bottomExpanded: resolve(v, s.bottomExpanded) })),
  setBottomClosed: (v) => set(s => ({ bottomClosed: resolve(v, s.bottomClosed) })),
  toggleBottomExpanded: () => set(s => ({ bottomExpanded: !s.bottomExpanded })),
}));
