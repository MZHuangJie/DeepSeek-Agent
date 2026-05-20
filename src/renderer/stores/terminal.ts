import { create } from 'zustand';

interface TermInstance {
  id: string;
  name: string;
}

interface TerminalState {
  terminals: TermInstance[];
  activeTermId: string | null;
  createTerminal: (shell?: string) => Promise<void>;
  closeTerminal: (id: string) => void;
  setActiveTerm: (id: string) => void;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  terminals: [],
  activeTermId: null,
  createTerminal: async (shell) => {
    const id = await window.api.terminal.create(shell);
    const isWin = navigator.userAgent.includes('Windows');
    const shellName = shell || (isWin ? 'powershell' : 'bash');
    set(s => ({
      terminals: [...s.terminals, { id, name: shellName }],
      activeTermId: id,
    }));
  },
  closeTerminal: (id) => {
    window.api.terminal.destroy(id);
    const { terminals, activeTermId } = get();
    const newTerms = terminals.filter(t => t.id !== id);
    set({
      terminals: newTerms,
      activeTermId: activeTermId === id ? (newTerms[0]?.id ?? null) : activeTermId,
    });
  },
  setActiveTerm: (id) => set({ activeTermId: id }),
}));
