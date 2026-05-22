import { create } from 'zustand';

interface RefsState {
  refFiles: string[];
  textRefs: string[];
  addRefFile: (path: string) => void;
  addTextRef: (text: string) => void;
  removeRefFile: (path: string) => void;
  removeTextRef: (text: string) => void;
  clearRefs: () => void;
}

export const useRefsStore = create<RefsState>((set) => ({
  refFiles: [],
  textRefs: [],

  addRefFile: (path) => set(s => ({
    refFiles: s.refFiles.includes(path) ? s.refFiles : [...s.refFiles, path],
  })),

  addTextRef: (text) => set(s => ({
    textRefs: s.textRefs.includes(text) ? s.textRefs : [...s.textRefs, text],
  })),

  removeRefFile: (path) => set(s => ({
    refFiles: s.refFiles.filter(p => p !== path),
  })),

  removeTextRef: (text) => set(s => ({
    textRefs: s.textRefs.filter(t => t !== text),
  })),

  clearRefs: () => set({ refFiles: [], textRefs: [] }),
}));
