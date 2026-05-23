import { create } from 'zustand';

export type ThemePreset = 'dark' | 'light' | 'dark-hc' | 'light-warm' | 'custom';

export type ThemeArea = 'global' | 'editor' | 'terminal' | 'sidebar' | 'chat' | 'agentPanel';

export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  border: string;
  chatUser: string;
  chatAi: string;
}

const PRESET_COLORS: Record<Exclude<ThemePreset, 'custom'>, ThemeColors> = {
  dark: { bgPrimary: '#1e1e2e', bgSecondary: '#252536', bgTertiary: '#2d2d44', textPrimary: '#e0e0e0', textSecondary: '#8888a0', accent: '#7c3aed', border: '#3a3a50', chatUser: 'rgba(124,58,237,0.1)', chatAi: '#2d2d44' },
  light: { bgPrimary: '#ffffff', bgSecondary: '#f5f5f5', bgTertiary: '#ebebeb', textPrimary: '#1e1e1e', textSecondary: '#666666', accent: '#7c3aed', border: '#d4d4d4', chatUser: 'rgba(124,58,237,0.08)', chatAi: '#f0f0f0' },
  'dark-hc': { bgPrimary: '#000000', bgSecondary: '#0d0d0d', bgTertiary: '#1a1a1a', textPrimary: '#ffffff', textSecondary: '#aaaaaa', accent: '#a78bfa', border: '#444444', chatUser: 'rgba(167,139,250,0.12)', chatAi: '#1a1a1a' },
  'light-warm': { bgPrimary: '#fefdf9', bgSecondary: '#f5f0e8', bgTertiary: '#ede4d3', textPrimary: '#3d3522', textSecondary: '#8b7e65', accent: '#7c3aed', border: '#d4c9b0', chatUser: 'rgba(124,58,237,0.08)', chatAi: '#f5f0e8' },
};

interface ThemeState {
  globalPreset: ThemePreset;
  globalCustom: ThemeColors;
  areas: Partial<Record<ThemeArea, { preset: ThemePreset; custom: ThemeColors }>>;
  setGlobalPreset: (p: ThemePreset) => void;
  setGlobalCustom: (c: ThemeColors) => void;
  setAreaPreset: (area: ThemeArea, p: ThemePreset) => void;
  setAreaCustom: (area: ThemeArea, c: ThemeColors) => void;
  resetArea: (area: ThemeArea) => void;
  getAreaColors: (area: ThemeArea) => ThemeColors;
}

function cssVarKey(area: ThemeArea, name: string): string {
  return `--ds-${area}-${name.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
}

function applyColors(element: HTMLElement | null, colors: ThemeColors, area: ThemeArea) {
  if (!element) return;
  const keys: Array<keyof ThemeColors> = ['bgPrimary', 'bgSecondary', 'bgTertiary', 'textPrimary', 'textSecondary', 'accent', 'border', 'chatUser', 'chatAi'];
  for (const k of keys) {
    element.style.setProperty(cssVarKey(area, k), colors[k]);
  }
}

function clearColors(element: HTMLElement | null, area: ThemeArea) {
  if (!element) return;
  const keys: Array<keyof ThemeColors> = ['bgPrimary', 'bgSecondary', 'bgTertiary', 'textPrimary', 'textSecondary', 'accent', 'border', 'chatUser', 'chatAi'];
  for (const k of keys) {
    element.style.removeProperty(cssVarKey(area, k));
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  globalPreset: 'dark',
  globalCustom: { ...PRESET_COLORS.dark },
  areas: {},

  setGlobalPreset: (p) => {
    document.documentElement.setAttribute('data-theme', p === 'custom' ? 'dark' : p);
    if (p !== 'custom') applyColors(document.documentElement, PRESET_COLORS[p], 'global');
    set({ globalPreset: p });
  },

  setGlobalCustom: (c) => {
    applyColors(document.documentElement, c, 'global');
    set({ globalCustom: c });
  },

  setAreaPreset: (area, p) => {
    const el = document.querySelector(`[data-area="${area}"]`);
    if (p === 'custom') {
      const prev = get().areas[area];
      if (prev?.custom) applyColors(el as HTMLElement, prev.custom, area);
    } else {
      if (p === get().globalPreset || get().globalPreset !== 'custom') {
        clearColors(el as HTMLElement, area);
      } else {
        applyColors(el as HTMLElement, PRESET_COLORS[p], area);
      }
    }
    set(s => ({ areas: { ...s.areas, [area]: { ...s.areas[area], preset: p } } }));
  },

  setAreaCustom: (area, c) => {
    const el = document.querySelector(`[data-area="${area}"]`);
    applyColors(el as HTMLElement, c, area);
    set(s => ({ areas: { ...s.areas, [area]: { ...s.areas[area], custom: c } } }));
  },

  resetArea: (area) => {
    const el = document.querySelector(`[data-area="${area}"]`);
    clearColors(el as HTMLElement, area);
    set(s => {
      const a = { ...s.areas };
      delete a[area];
      return { areas: a };
    });
  },

  getAreaColors: (area) => {
    const s = get();
    const a = s.areas[area];
    if (a?.preset === 'custom' && a.custom) return a.custom;
    if (a?.preset && a.preset !== 'custom') return PRESET_COLORS[a.preset];
    if (s.globalPreset === 'custom') return s.globalCustom;
    return PRESET_COLORS[s.globalPreset];
  },
}));
