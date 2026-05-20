import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinkingContent?: string;
  toolCalls?: ToolCall[];
  timestamp: number;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: string;
  timestamp: number;
  status: 'running' | 'success' | 'error';
}

export interface Session {
  id: string;
  title: string;
  messages: Message[];
}

interface ChatState {
  sessions: Session[];
  activeSessionId: string | null;
  isStreaming: boolean;
  loadSessions: () => Promise<void>;
  createSession: () => void;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  addMessage: (msg: Message) => void;
  setStreaming: (v: boolean) => void;
  updateLastAssistant: (update: Partial<Message>) => void;
}

let sessionCounter = 0;

function persist(sessions: Session[]) {
  for (const s of sessions) {
    window.api.sessions.save(s.id, s.title, JSON.stringify(s.messages));
  }
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  isStreaming: false,

  loadSessions: async () => {
    try {
      const raw = await window.api.sessions.loadAll();
      if (raw && Array.isArray(raw)) {
        const sessions: Session[] = raw.map((r: any) => ({
          id: r.id,
          title: r.title,
          messages: (() => {
            try { return JSON.parse(r.messages); } catch { return []; }
          })(),
        }));
        if (sessions.length > 0) {
          const maxCounter = sessions.reduce((max, s) => {
            const match = s.title.match(/会话 #(\d+)/);
            return match ? Math.max(max, parseInt(match[1])) : max;
          }, 0);
          sessionCounter = maxCounter;
          set({ sessions, activeSessionId: sessions[0].id });
        }
      }
    } catch {
      // use empty state on load failure
    }
  },

  createSession: () => {
    sessionCounter++;
    const session: Session = {
      id: `session-${Date.now()}`,
      title: `会话 #${sessionCounter}`,
      messages: [],
    };
    set(s => ({
      sessions: [...s.sessions, session],
      activeSessionId: session.id,
    }));
    window.api.sessions.save(session.id, session.title, '[]');
  },

  switchSession: (id) => set({ activeSessionId: id }),

  deleteSession: (id) => {
    window.api.sessions.delete(id);
    const { activeSessionId, sessions } = get();
    const newSessions = sessions.filter(s => s.id !== id);
    set({
      sessions: newSessions,
      activeSessionId: activeSessionId === id ? (newSessions[0]?.id ?? null) : activeSessionId,
    });
  },

  addMessage: (msg) => {
    const { activeSessionId, sessions } = get();
    const newSessions = sessions.map(s => {
      if (s.id !== activeSessionId) return s;
      const newMessages = [...s.messages, msg];
      let title = s.title;
      if (s.messages.length === 0 && msg.role === 'user') {
        title = msg.content.slice(0, 40) + (msg.content.length > 40 ? '...' : '');
      }
      return { ...s, title, messages: newMessages };
    });
    set({ sessions: newSessions });
    persist(newSessions);
  },

  setStreaming: (v) => set({ isStreaming: v }),

  updateLastAssistant: (update) => {
    const { activeSessionId, sessions } = get();
    const newSessions = sessions.map(s => {
      if (s.id !== activeSessionId) return s;
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === 'assistant') {
        msgs[msgs.length - 1] = { ...last, ...update };
      }
      return { ...s, messages: msgs };
    });
    set({ sessions: newSessions });
    persist(newSessions);
  },
}));
