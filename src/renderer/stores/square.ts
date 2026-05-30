import { create } from 'zustand';

export interface SquareCharacter {
  id: string;
  name: string;
  userName: string;
  portraitBase64?: string;
  portraitFullBase64?: string;
  personality?: string;
  background?: string;
  gender?: string;
  occupation?: string;
  heat: number;
  isFavorited: boolean;
  shared: boolean;
  updatedAt: number;
}

export interface SquareModel {
  id: string;
  name: string;
  userName: string;
  provider: string;
  baseUrl: string;
  modelId: string;
  contextWindow: number;
  shared: boolean;
  updatedAt: number;
}

export interface SquareTemplate {
  id: string;
  name: string;
  userName: string;
  portraitBase64?: string;
  portraitFullBase64?: string;
  personality?: string;
  background?: string;
  gender?: string;
  occupation?: string;
  updatedAt: number;
}

interface SquareState {
  characters: SquareCharacter[];
  favorites: SquareCharacter[];
  templates: SquareTemplate[];
  models: SquareModel[];
  myModels: SquareModel[];
  loading: boolean;
  error: string | null;
  loadCharacters: () => Promise<void>;
  loadFavorites: () => Promise<void>;
  loadTemplates: () => Promise<void>;
  loadModels: () => Promise<void>;
  toggleFavorite: (id: string) => Promise<boolean>;
  toggleCharacterShared: (id: string) => Promise<boolean | null>;
  toggleTemplateShared: (id: string) => Promise<boolean | null>;
  toggleModelShared: (id: string) => Promise<boolean | null>;
  pushModel: (model: {
    id: string;
    name: string;
    provider: string;
    baseUrl: string;
    modelId: string;
    contextWindow?: number;
  }) => Promise<boolean>;
  deleteModel: (id: string) => Promise<boolean>;
  loadMyModels: () => Promise<void>;
  clearError: () => void;
}

export const useSquareStore = create<SquareState>((set) => ({
  characters: [],
  favorites: [],
  templates: [],
  models: [],
  myModels: [],
  loading: false,
  error: null,

  loadCharacters: async () => {
    set({ loading: true, error: null });
    try {
      const res = await window.api.square.listCharacters();
      if (res.success && res.characters) {
        set({ characters: res.characters, loading: false });
      } else {
        set({ error: res.error || '获取广场角色失败', loading: false });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误', loading: false });
    }
  },

  loadFavorites: async () => {
    set({ loading: true, error: null });
    try {
      const res = await window.api.square.listFavorites();
      if (res.success && res.characters) {
        set({ favorites: res.characters, loading: false });
      } else {
        set({ error: res.error || '获取收藏列表失败', loading: false });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误', loading: false });
    }
  },

  loadTemplates: async () => {
    set({ loading: true, error: null });
    try {
      const res = await window.api.square.listTemplates();
      if (res.success && res.templates) {
        set({ templates: res.templates, loading: false });
      } else {
        set({ error: res.error || '获取广场模板失败', loading: false });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误', loading: false });
    }
  },

  loadModels: async () => {
    set({ loading: true, error: null });
    try {
      const res = await window.api.square.listModels();
      if (res.success && res.models) {
        set({ models: res.models, loading: false });
      } else {
        set({ error: res.error || '获取广场模型失败', loading: false });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误', loading: false });
    }
  },

  toggleFavorite: async (id) => {
    set({ error: null });
    try {
      const res = await window.api.square.favoriteCharacter(id);
      if (res.success) {
        const favorited = res.favorited ?? false;
        // Update characters list
        set((s) => ({
          characters: s.characters.map(c =>
            c.id === id
              ? { ...c, isFavorited: favorited, heat: favorited ? c.heat + 1 : Math.max(0, c.heat - 1) }
              : c
          ),
        }));
        // Update favorites list
        if (favorited) {
          const char = useSquareStore.getState().characters.find(c => c.id === id);
          if (char) {
            set((s) => ({ favorites: [{ ...char, isFavorited: true }, ...s.favorites.filter(f => f.id !== id)] }));
          }
        } else {
          set((s) => ({ favorites: s.favorites.filter(f => f.id !== id) }));
        }
        return favorited;
      }
      set({ error: res.error || '收藏操作失败' });
      return false;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误' });
      return false;
    }
  },

  toggleCharacterShared: async (id) => {
    set({ error: null });
    try {
      const res = await window.api.square.toggleCharacterShared(id);
      if (res.success) {
        return res.shared ?? null;
      }
      set({ error: res.error || '切换分享失败' });
      return null;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误' });
      return null;
    }
  },

  toggleTemplateShared: async (id) => {
    set({ error: null });
    try {
      const res = await window.api.square.toggleTemplateShared(id);
      if (res.success) {
        return res.shared ?? null;
      }
      set({ error: res.error || '切换分享失败' });
      return null;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误' });
      return null;
    }
  },

  toggleModelShared: async (id) => {
    set({ error: null });
    try {
      const res = await window.api.square.toggleModelShared(id);
      if (res.success) {
        set((s) => ({
          myModels: s.myModels.map(m =>
            m.id === id ? { ...m, shared: res.shared ?? m.shared } : m
          ),
        }));
        return res.shared ?? null;
      }
      set({ error: res.error || '切换分享失败' });
      return null;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误' });
      return null;
    }
  },

  pushModel: async (model) => {
    set({ error: null });
    try {
      const res = await window.api.square.pushModel(model);
      if (res.success) {
        set((s) => ({
          myModels: [
            { id: model.id, name: model.name, userName: '', provider: model.provider, baseUrl: model.baseUrl, modelId: model.modelId, contextWindow: model.contextWindow ?? 64000, shared: false, updatedAt: Date.now() },
            ...s.myModels.filter(m => m.id !== model.id),
          ],
        }));
        return true;
      }
      set({ error: res.error || '上传模型失败' });
      return false;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误' });
      return false;
    }
  },

  deleteModel: async (id) => {
    set({ error: null });
    try {
      const res = await window.api.square.deleteModel(id);
      if (res.success) {
        set((s) => ({ myModels: s.myModels.filter(m => m.id !== id) }));
        return true;
      }
      set({ error: res.error || '删除模型失败' });
      return false;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误' });
      return false;
    }
  },

  loadMyModels: async () => {
    set({ loading: true, error: null });
    try {
      const res = await window.api.square.listMyModels();
      if (res.success && res.models) {
        set({ myModels: res.models, loading: false });
      } else {
        set({ error: res.error || '获取我的模型失败', loading: false });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误', loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
