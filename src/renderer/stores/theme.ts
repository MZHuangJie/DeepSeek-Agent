import { create } from 'zustand';

export type ThemePreset = 'dark' | 'light' | 'dark-hc' | 'light-warm';

interface AreaTheme {
  global: ThemePreset;
  editor: ThemePreset | null;    // null = 继承全局
  terminal: ThemePreset | null;
  sidebar: ThemePreset | null;
  chat: ThemePreset | null;
  agentPanel: ThemePreset | null;
}

interface ThemeState extends AreaTheme {
  setGlobalTheme: (t: ThemePreset) => void;
  setAreaTheme: (area: keyof Omit<AreaTheme, 'global'>, t: ThemePreset | null) => void;
  resetArea: (area: keyof Omit<AreaTheme, 'global'>) => void;
  getTheme: (area: keyof Omit<AreaTheme, 'global'>) => ThemePreset;
}

function applyTheme(element: HTMLElement | null, theme: ThemePreset | null) {
  if (!element) return;
  if (theme) {
    element.setAttribute('data-theme', theme);
  } else {
    element.removeAttribute('data-theme');
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  global: 'dark',
  editor: null,
  terminal: null,
  sidebar: null,
  chat: null,
  agentPanel: null,

  setGlobalTheme: (t) => {
    document.documentElement.setAttribute('data-theme', t);
    set({ global: t });
    // 重新应用所有区域（清除 data-theme 让它们继承全局）
    const areas: Array<keyof Omit<AreaTheme, 'global'>> = ['editor', 'terminal', 'sidebar', 'chat', 'agentPanel'];
    for (const a of areas) {
      const el = document.querySelector(`[data-area="${a}"]`);
      if (!get()[a]) applyTheme(el as HTMLElement, null);
    }
  },

  setAreaTheme: (area, t) => {
    const el = document.querySelector(`[data-area="${area}"]`);
    applyTheme(el as HTMLElement, t);
    set({ [area]: t } as any);
  },

  resetArea: (area) => {
    const el = document.querySelector(`[data-area="${area}"]`);
    applyTheme(el as HTMLElement, null);
    set({ [area]: null } as any);
  },

  getTheme: (area) => {
    const state = get();
    return (state[area] as ThemePreset | null) ?? state.global;
  },
}));
