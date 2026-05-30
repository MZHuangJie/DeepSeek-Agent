import { create } from 'zustand';

export interface CloudSessionMeta {
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
}

export interface CloudCharacterMeta {
  id: string;
  name: string;
  updatedAt: number;
  portraitBase64?: string;
  portraitFullBase64?: string;
  personality?: string;
  background?: string;
  shared?: boolean;
}

export interface CloudTemplateMeta {
  id: string;
  name: string;
  updatedAt: number;
  portraitBase64?: string;
  portraitFullBase64?: string;
  personality?: string;
  background?: string;
  shared?: boolean;
}

interface SyncState {
  cloudSessions: CloudSessionMeta[];
  cloudCharacters: CloudCharacterMeta[];
  cloudTemplates: CloudTemplateMeta[];
  loading: boolean;
  error: string | null;
  lastSyncAt: number | null;
  loadCloudSessions: () => Promise<void>;
  loadCloudCharacters: () => Promise<void>;
  loadCloudTemplates: () => Promise<void>;
  pushSession: (sessionId: string, title: string, payload: string) => Promise<boolean>;
  pullSession: (sessionId: string) => Promise<{ title: string; payload: string } | null>;
  deleteCloudSession: (sessionId: string) => Promise<boolean>;
  pushCharacter: (characterId: string, name: string, payload: string) => Promise<boolean>;
  pullCharacter: (characterId: string) => Promise<{ name: string; payload: string } | null>;
  deleteCloudCharacter: (characterId: string) => Promise<boolean>;
  pushTemplate: (templateId: string, name: string, payload: string) => Promise<boolean>;
  pullTemplate: (templateId: string) => Promise<{ name: string; payload: string } | null>;
  deleteCloudTemplate: (templateId: string) => Promise<boolean>;
  clearError: () => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  cloudSessions: [],
  cloudCharacters: [],
  cloudTemplates: [],
  loading: false,
  error: null,
  lastSyncAt: null,

  loadCloudSessions: async () => {
    set({ loading: true, error: null });
    try {
      const res = await window.api.sync.listSessions();
      if (res.success && res.sessions) {
        set({ cloudSessions: res.sessions, loading: false, lastSyncAt: Date.now() });
      } else {
        set({ error: res.error || '获取失败', loading: false });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误', loading: false });
    }
  },

  loadCloudCharacters: async () => {
    set({ loading: true, error: null });
    try {
      const res = await window.api.sync.listCharacters();
      if (res.success && res.characters) {
        const list = res.characters;
        // 并行拉取每个角色的完整 payload，提取 portrait + personality + background
        const enriched = await Promise.all(
          list.map(async (meta: CloudCharacterMeta) => {
            try {
              const detail = await window.api.sync.getCharacter(meta.id);
              if (detail.success && detail.character) {
                const parsed = JSON.parse(detail.character.payload);
                return {
                  ...meta,
                  portraitBase64: parsed.portraitBase64 as string | undefined,
                  portraitFullBase64: parsed.portraitFullBase64 as string | undefined,
                  personality: parsed.personality as string | undefined,
                  background: parsed.background as string | undefined,
                };
              }
            } catch (e) {
              console.warn('[sync] enrich character failed:', meta.id, e);
            }
            return meta;
          }),
        );
        set({ cloudCharacters: enriched, loading: false, lastSyncAt: Date.now() });
      } else {
        set({ error: res.error || '获取失败', loading: false });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误', loading: false });
    }
  },

  pushSession: async (sessionId, title, payload) => {
    set({ error: null });
    try {
      const res = await window.api.sync.pushSession(sessionId, title, payload);
      if (res.success) {
        set((s) => ({
          cloudSessions: [
            { id: sessionId, title, updatedAt: Date.now(), messageCount: 0 },
            ...s.cloudSessions.filter((c) => c.id !== sessionId),
          ],
        }));
        return true;
      }
      set({ error: res.error || '上传失败' });
      return false;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误' });
      return false;
    }
  },

  pullSession: async (sessionId) => {
    set({ error: null });
    try {
      const res = await window.api.sync.getSession(sessionId);
      if (res.success && res.session) {
        return { title: res.session.title, payload: res.session.payload };
      }
      set({ error: res.error || '拉取失败' });
      return null;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误' });
      return null;
    }
  },

  deleteCloudSession: async (sessionId) => {
    set({ error: null });
    try {
      const res = await window.api.sync.deleteSession(sessionId);
      if (res.success) {
        set((s) => ({ cloudSessions: s.cloudSessions.filter((c) => c.id !== sessionId) }));
        return true;
      }
      set({ error: res.error || '删除失败' });
      return false;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误' });
      return false;
    }
  },

  pushCharacter: async (characterId, name, payload) => {
    set({ error: null });
    try {
      const res = await window.api.sync.pushCharacter(characterId, name, payload);
      if (res.success) {
        set((s) => ({
          cloudCharacters: [
            { id: characterId, name, updatedAt: Date.now() },
            ...s.cloudCharacters.filter((c) => c.id !== characterId),
          ],
        }));
        return true;
      }
      set({ error: res.error || '上传失败' });
      return false;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误' });
      return false;
    }
  },

  pullCharacter: async (characterId) => {
    set({ error: null });
    try {
      const res = await window.api.sync.getCharacter(characterId);
      if (res.success && res.character) {
        return { name: res.character.name, payload: res.character.payload };
      }
      set({ error: res.error || '拉取失败' });
      return null;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误' });
      return null;
    }
  },

  deleteCloudCharacter: async (characterId) => {
    set({ error: null });
    try {
      const res = await window.api.sync.deleteCharacter(characterId);
      if (res.success) {
        set((s) => ({ cloudCharacters: s.cloudCharacters.filter((c) => c.id !== characterId) }));
        return true;
      }
      set({ error: res.error || '删除失败' });
      return false;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误' });
      return false;
    }
  },

  loadCloudTemplates: async () => {
    set({ loading: true, error: null });
    try {
      const res = await window.api.sync.listTemplates();
      if (res.success && res.templates) {
        const list = res.templates;
        const enriched = await Promise.all(
          list.map(async (meta: CloudTemplateMeta) => {
            try {
              const detail = await window.api.sync.getTemplate(meta.id);
              if (detail.success && detail.template) {
                const parsed = JSON.parse(detail.template.payload);
                return {
                  ...meta,
                  portraitBase64: parsed.portraitBase64 as string | undefined,
                  portraitFullBase64: parsed.portraitFullBase64 as string | undefined,
                  personality: parsed.personality as string | undefined,
                  background: parsed.background as string | undefined,
                };
              }
            } catch (e) {
              console.warn('[sync] enrich template failed:', meta.id, e);
            }
            return meta;
          }),
        );
        set({ cloudTemplates: enriched, loading: false, lastSyncAt: Date.now() });
      } else {
        set({ error: res.error || '获取失败', loading: false });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误', loading: false });
    }
  },

  pushTemplate: async (templateId, name, payload) => {
    set({ error: null });
    try {
      const res = await window.api.sync.pushTemplate(templateId, name, payload);
      if (res.success) {
        set((s) => ({
          cloudTemplates: [
            { id: templateId, name, updatedAt: Date.now() },
            ...s.cloudTemplates.filter((c) => c.id !== templateId),
          ],
        }));
        return true;
      }
      set({ error: res.error || '上传失败' });
      return false;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误' });
      return false;
    }
  },

  pullTemplate: async (templateId) => {
    set({ error: null });
    try {
      const res = await window.api.sync.getTemplate(templateId);
      if (res.success && res.template) {
        return { name: res.template.name, payload: res.template.payload };
      }
      set({ error: res.error || '拉取失败' });
      return null;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误' });
      return null;
    }
  },

  deleteCloudTemplate: async (templateId) => {
    set({ error: null });
    try {
      const res = await window.api.sync.deleteTemplate(templateId);
      if (res.success) {
        set((s) => ({ cloudTemplates: s.cloudTemplates.filter((c) => c.id !== templateId) }));
        return true;
      }
      set({ error: res.error || '删除失败' });
      return false;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误' });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
