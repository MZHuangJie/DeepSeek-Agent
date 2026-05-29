import { create } from 'zustand';

export interface AuthUser {
  id: number;
  username: string;
  email: string | null;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  apiBase: string;
  apiBaseEditable: boolean;
  error: string | null;
  restore: () => Promise<void>;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string, email?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  loadApiBase: () => Promise<void>;
  setApiBase: (baseUrl: string) => Promise<void>;
  updateUser: (username: string) => Promise<boolean>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  apiBase: '',
  apiBaseEditable: false,
  error: null,

  loadApiBase: async () => {
    const [apiBase, apiBaseEditable] = await Promise.all([
      window.api.auth.getApiBase(),
      window.api.auth.isApiBaseEditable(),
    ]);
    set({ apiBase, apiBaseEditable });
  },

  restore: async () => {
    set({ status: 'loading', error: null });
    try {
      const apiBase = await window.api.auth.getApiBase();
      const result = await window.api.auth.restore();
      if (result.success && result.user) {
        set({ status: 'authenticated', user: result.user, apiBase, error: null });
      } else {
        set({ status: 'unauthenticated', user: null, apiBase, error: result.error ?? null });
      }
    } catch {
      set({ status: 'unauthenticated', user: null, error: '无法恢复登录状态' });
    }
  },

  login: async (username, password) => {
    set({ error: null });
    const result = await window.api.auth.login(username, password);
    if (result.success && result.user) {
      set({ status: 'authenticated', user: result.user, error: null });
      return true;
    }
    set({ error: result.error || '登录失败' });
    return false;
  },

  register: async (username, password, email) => {
    set({ error: null });
    const result = await window.api.auth.register(username, password, email);
    if (result.success && result.user) {
      set({ status: 'authenticated', user: result.user, error: null });
      return true;
    }
    set({ error: result.error || '注册失败' });
    return false;
  },

  logout: async () => {
    await window.api.auth.logout();
    set({ status: 'unauthenticated', user: null, error: null });
  },

  setApiBase: async (baseUrl) => {
    await window.api.auth.setApiBase(baseUrl.trim());
    const apiBase = await window.api.auth.getApiBase();
    set({ apiBase });
  },

  updateUser: async (username) => {
    set({ error: null });
    const result = await window.api.auth.updateProfile(username);
    if (result.success && result.user) {
      set({ user: result.user, error: null });
      return true;
    }
    set({ error: result.error || '更新失败' });
    return false;
  },

  clearError: () => set({ error: null }),
}));
