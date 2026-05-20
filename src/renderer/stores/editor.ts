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
  setCursor: (line: number, column: number) => void;
  setIndent: (insertSpaces: boolean, tabSize: number) => void;
  setEol: (eol: 'LF' | 'CRLF') => void;
  setDiagnostics: (errors: number, warnings: number) => void;
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
  setCursor: (line, column) => set({ line, column }),
  setIndent: (insertSpaces, tabSize) => set({ insertSpaces, tabSize }),
  setEol: (eol) => set({ eol }),
  setDiagnostics: (errorCount, warningCount) => set({ errorCount, warningCount }),
}));
