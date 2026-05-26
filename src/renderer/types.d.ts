import type { API } from '../preload/index';

declare module 'react' {
  interface CSSProperties {
    WebkitAppRegion?: string;
  }
}

declare global {
  interface Window {
    api: API & {
      sessions: {
        save: (id: string, title: string, messages: string) => Promise<{ success: boolean }>;
        loadAll: () => Promise<Array<{ id: string; title: string; messages: string }>>;
        delete: (id: string) => Promise<{ success: boolean }>;
        generateTitle: (payload: {
          userMessage: string;
          assistantPreview?: string;
          model?: string;
          baseUrl?: string;
          apiKey?: string;
        }) => Promise<{ success: true; title: string } | { success: false; error: string }>;
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
