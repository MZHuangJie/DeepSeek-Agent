import { create } from 'zustand';

interface BrowserState {
  url: string;
  open: boolean;
  setUrl: (url: string) => void;
  openUrl: (url: string) => void;
  setOpen: (open: boolean) => void;
}

export const useBrowserStore = create<BrowserState>((set) => ({
  url: 'https://www.google.com',
  open: false,
  setUrl: (url) => set({ url }),
  openUrl: (url) => set({ url, open: true }),
  setOpen: (open) => set({ open }),
}));
