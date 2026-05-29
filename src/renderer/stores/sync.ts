import { create } from 'zustand';

export interface CloudSessionMeta {
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
}

interface SyncState {
  cloudSessions: CloudSessionMeta[];
  loading: boolean;
  error: string | null;
  lastSyncAt: number | null;
  loadCloudSessions: () => Promise<void>;
  pushSession: (sessionId: string, title: string, payload: string) => Promise<boolean>;
  pullSession: (sessionId: string) => Promise<{ title: string; payload: string } | null>;
  deleteCloudSession: (sessionId: string) => Promise<boolean>;
  clearError: () => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  cloudSessions: [],
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

  pushSession: async (sessionId, title, payload) => {
    set({ error: null });
    try {
      const res = await window.api.sync.pushSession(sessionId, title, payload);
      if (res.success) {
        set(s => ({
          cloudSessions: [
            { id: sessionId, title, updatedAt: Date.now(), messageCount: 0 },
            ...s.cloudSessions.filter(c => c.id !== sessionId),
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
        set(s => ({ cloudSessions: s.cloudSessions.filter(c => c.id !== sessionId) }));
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
