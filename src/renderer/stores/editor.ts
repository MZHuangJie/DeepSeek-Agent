import { create } from 'zustand';

interface EditorState {
  line: number;
  column: number;
  insertSpaces: boolean;
  tabSize: number;
  eol: 'LF' | 'CRLF';
  encoding: string;
  errorCount: number;
  warningCount: number;
  goToTarget: { path: string; line: number; column?: number } | null;
  setCursor: (line: number, column: number) => void;
  setIndent: (insertSpaces: boolean, tabSize: number) => void;
  setEol: (eol: 'LF' | 'CRLF') => void;
  setDiagnostics: (errors: number, warnings: number) => void;
  requestGoToLine: (path: string, line: number, column?: number) => void;
  clearGoToTarget: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  line: 1,
  column: 1,
  insertSpaces: true,
  tabSize: 2,
  eol: 'LF',
  encoding: 'UTF-8',
  errorCount: 0,
  warningCount: 0,
  goToTarget: null,
  setCursor: (line, column) => set({ line, column }),
  setIndent: (insertSpaces, tabSize) => set({ insertSpaces, tabSize }),
  setEol: (eol) => set({ eol }),
  setDiagnostics: (errorCount, warningCount) => set({ errorCount, warningCount }),
  requestGoToLine: (path, line, column = 1) => set({ goToTarget: { path, line, column } }),
  clearGoToTarget: () => set({ goToTarget: null }),
}));
