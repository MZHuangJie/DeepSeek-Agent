import type { API } from '../preload/index';

declare global {
  interface Window {
    api: API & {
      sessions: {
        save: (id: string, title: string, messages: string) => Promise<{ success: boolean }>;
        loadAll: () => Promise<Array<{ id: string; title: string; messages: string }>>;
        delete: (id: string) => Promise<{ success: boolean }>;
      };
    };
  }
}
