import { create } from 'zustand';

export interface ConfirmOptions {
  message: string;
  onConfirm: () => void;
}

interface ConfirmState {
  open: boolean;
  message: string;
  onConfirm: (() => void) | null;
  show: (opts: ConfirmOptions) => void;
  close: () => void;
}

export const useConfirmStore = create<ConfirmState>((set) => ({
  open: false,
  message: '',
  onConfirm: null,
  show: ({ message, onConfirm }) => set({ open: true, message, onConfirm }),
  close: () => set({ open: false, message: '', onConfirm: null }),
}));
