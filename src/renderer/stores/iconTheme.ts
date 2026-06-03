import { create } from 'zustand';
import type { IconThemeDocument } from '../utils/iconThemeCss';
import { generateIconThemeCss } from '../utils/iconThemeCss';

/* ---- Constants ---- */

export const BUNDLED_THEMES = ['seti', 'minimal'] as const;
export type IconThemeId = typeof BUNDLED_THEMES[number];

const STYLE_CLASS = 'contributedFileIconTheme';
const SCOPE_CLASS = 'show-file-icons';

export interface IconThemeManifest {
  id: IconThemeId;
  label: string;
  description?: string;
}

/* ---- DOM helpers ---- */

function injectCss(css: string): void {
  const existing = document.head.querySelector(`style.${STYLE_CLASS}`);
  if (existing) existing.remove();

  const style = document.createElement('style');
  style.className = STYLE_CLASS;
  style.textContent = css;
  document.head.appendChild(style);

  document.documentElement.classList.add(SCOPE_CLASS);
}

/* ---- Store ---- */

interface IconThemeState {
  availableThemes: IconThemeManifest[];
  currentThemeId: IconThemeId;
  activeTheme: IconThemeDocument | null;
  busy: boolean;

  loadThemes: () => Promise<void>;
  setTheme: (id: IconThemeId) => Promise<void>;
}

export const useIconThemeStore = create<IconThemeState>((set, get) => ({
  availableThemes: [],
  currentThemeId: 'seti',
  activeTheme: null,
  busy: false,

  loadThemes: async () => {
    const manifests: IconThemeManifest[] = [
      { id: 'seti', label: 'Seti (Visual Studio Code)', description: '默认文件图标主题' },
      { id: 'minimal', label: 'Minimal', description: '极简文件与文件夹图标' },
    ];
    set({ availableThemes: manifests });

    // Restore persisted preference
    let targetId: IconThemeId = 'seti';
    try {
      const saved = await window.api.settings.get('iconTheme');
      if (saved && BUNDLED_THEMES.includes(saved as IconThemeId)) {
        targetId = saved as IconThemeId;
      }
    } catch {
      // settings might not be available (e.g. in tests)
    }

    await get().setTheme(targetId);
  },

  setTheme: async (id: IconThemeId) => {
    set({ busy: true });
    try {
      const themeModule = await import(`../assets/iconThemes/${id}.json`);
      const theme: IconThemeDocument = themeModule.default ?? themeModule;

      const css = generateIconThemeCss(theme);
      injectCss(css);

      // Persist to settings
      try {
        await window.api.settings.set('iconTheme', id);
      } catch {
        // settings might not be available
      }

      set({
        currentThemeId: id,
        activeTheme: theme,
        busy: false,
      });
    } catch (err) {
      console.error(`Failed to load icon theme "${id}":`, err);
      set({ busy: false });
    }
  },
}));
