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
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src?: string;
        ref?: React.Ref<any>;
        style?: React.CSSProperties;
      }, HTMLElement>;
    }
  }
}
