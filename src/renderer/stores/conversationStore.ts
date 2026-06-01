// src/renderer/stores/conversationStore.ts
import { create } from 'zustand';
import type { Conversation, ConversationMember, ConversationType, Message, DriverConfig } from '../../common/conversation';
import { useModeStore } from './mode';

let soloCounter = 0;

function findMaxSoloCounter(convs: Conversation[]): number {
  return convs.reduce((max, c) => {
    const match = c.title.match(/会话 #(\d+)/);
    return match ? Math.max(max, parseInt(match[1])) : max;
  }, 0);
}

function serializeConversation(conv: Conversation): string {
  return JSON.stringify({
    messages: conv.messages,
    members: conv.members,
    type: conv.type,
    driver: conv.driver,
    lastMessage: conv.lastMessage,
    characterId: conv.characterId,
    characterIds: conv.characterIds,
    planTodos: conv.planTodos,
    planDocPath: conv.planDocPath,
    pendingOpening: conv.pendingOpening,
    sessionMode: conv.sessionMode,
  });
}

function parseConversationPayload(raw: string): {
  messages: Message[];
  members: ConversationMember[];
  type: ConversationType;
  driver: DriverConfig;
  lastMessage?: Conversation['lastMessage'];
  characterId?: string;
  characterIds?: string[];
  planTodos?: Conversation['planTodos'];
  planDocPath?: string;
  pendingOpening?: boolean;
  sessionMode?: 'roleplay';
} {
  try {
    const parsed = JSON.parse(raw);
    return {
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      members: Array.isArray(parsed.members) ? parsed.members : [],
      type: parsed.type || 'solo',
      driver: parsed.driver || { mode: 'simple', maxRounds: 8 },
      lastMessage: parsed.lastMessage,
      characterId: parsed.characterId,
      characterIds: parsed.characterIds,
      planTodos: Array.isArray(parsed.planTodos) ? parsed.planTodos : undefined,
      planDocPath: parsed.planDocPath,
      pendingOpening: parsed.pendingOpening,
      sessionMode: parsed.sessionMode === 'dzmm' ? 'roleplay' : parsed.sessionMode,
    };
  } catch {
    return { messages: [], members: [], type: 'solo', driver: { mode: 'simple', maxRounds: 8 } };
  }
}

function persistConversation(conv: Conversation) {
  window.api.conversations.save(conv.id, conv.title, serializeConversation(conv));
}

function persistAll(convs: Conversation[]) {
  for (const c of convs) persistConversation(c);
}

interface ConversationState {
  conversations: Conversation[];
  activeId: string | null;
  isStreaming: boolean;

  loadAll: () => Promise<void>;
  migrateFromSessions: () => Promise<void>;
  createSolo: () => void;
  createGroup: (type: 'group_npc' | 'group_agent', members: ConversationMember[], name?: string) => Conversation | null;
  switchTo: (id: string) => void;
  delete: (id: string) => void;
  addMessage: (msg: Message) => void;
  updateLastAssistant: (update: Partial<Message>, convId?: string) => void;
  newAssistantMessage: (convId?: string) => void;
  setStreaming: (v: boolean) => void;
  updateTitle: (id: string, title: string) => void;

  webPreviewHtml: string | null;
  webPreviewFile: string | null;
  setWebPreviewHtml: (html: string | null) => void;
  setWebPreviewFile: (file: string | null) => void;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  activeId: null,
  isStreaming: false,
  webPreviewHtml: null,
  webPreviewFile: null,

  loadAll: async () => {
    try {
      const raw = await window.api.conversations.loadAll();
      if (raw && Array.isArray(raw)) {
        const conversations: Conversation[] = raw.map((r: any) => {
          const payload = parseConversationPayload(r.payload);
          return {
            id: r.id,
            title: r.title,
            type: payload.type,
            avatar: undefined,
            members: payload.members,
            messages: payload.messages,
            lastMessage: payload.lastMessage,
            driver: payload.driver,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            characterId: payload.characterId,
            characterIds: payload.characterIds,
            planTodos: payload.planTodos,
            planDocPath: payload.planDocPath,
            pendingOpening: payload.pendingOpening,
            sessionMode: payload.sessionMode,
          };
        });
        if (conversations.length > 0) {
          soloCounter = findMaxSoloCounter(conversations.filter(c => c.type === 'solo'));
          const currentActive = get().activeId;
          if (currentActive === null || !conversations.find(c => c.id === currentActive)) {
            set({ conversations, activeId: conversations[0].id });
          } else {
            set({ conversations });
          }
        }
      }
    } catch { /* empty on load failure */ }
  },

  migrateFromSessions: async () => {
    try {
      const alreadyMigrated = await window.api.conversations.getMigrated();
      if (alreadyMigrated) return;
    } catch { /* proceed with migration */ }

    try {
      const raw = await window.api.sessions.loadAll();
      if (!raw || !Array.isArray(raw) || raw.length === 0) return;

      for (const s of raw) {
        const parsed = (() => {
          try {
            const p = JSON.parse(s.messages);
            return {
              messages: Array.isArray(p) ? p : Array.isArray(p?.messages) ? p.messages : [],
              characterId: p?.characterId,
              characterIds: p?.characterIds,
              planTodos: p?.planTodos,
              planDocPath: p?.planDocPath,
              pendingOpening: p?.pendingOpening,
              sessionMode: p?.sessionMode,
            };
          } catch { return { messages: [] }; }
        })();

        const hasMultiChars = parsed.characterIds && parsed.characterIds.length >= 2;
        const type: ConversationType = hasMultiChars ? 'group_npc' : 'solo';

        const payload = JSON.stringify({
          messages: parsed.messages,
          members: [],
          type,
          driver: { mode: type === 'solo' ? 'simple' : 'director', maxRounds: 8 },
          characterId: parsed.characterId,
          characterIds: parsed.characterIds,
          planTodos: parsed.planTodos,
          planDocPath: parsed.planDocPath,
          pendingOpening: parsed.pendingOpening,
          sessionMode: parsed.sessionMode,
        });

        await window.api.conversations.save(s.id, s.title, payload);
      }

      await window.api.conversations.setMigrated();
      await get().loadAll();
    } catch { /* migration failure is non-fatal */ }
  },

  createSolo: () => {
    soloCounter++;
    const conv: Conversation = {
      id: `conv-${Date.now()}`,
      type: 'solo',
      title: `会话 #${soloCounter}`,
      members: [],
      messages: [],
      driver: { mode: 'simple', maxRounds: 8 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set(s => ({
      conversations: [conv, ...s.conversations],
      activeId: conv.id,
    }));
    persistConversation(conv);
  },

  createGroup: (type, members, name) => {
    if (members.length < 2) return null;
    const conv: Conversation = {
      id: `conv-${Date.now()}`,
      type,
      title: name || (type === 'group_npc' ? 'NPC 群聊' : 'Agent 群聊'),
      members,
      messages: [],
      driver: { mode: 'director', maxRounds: 8 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set(s => ({
      conversations: [conv, ...s.conversations],
      activeId: conv.id,
    }));
    persistConversation(conv);
    return conv;
  },

  switchTo: (id) => {
    set({ activeId: id, webPreviewHtml: null, webPreviewFile: null });
    const conv = get().conversations.find(c => c.id === id);
    if (conv && conv.sessionMode === 'roleplay') {
      useModeStore.getState().setMode('roleplay');
    }
  },

  delete: (id) => {
    window.api.conversations.delete(id);
    const { activeId, conversations } = get();
    const newConvs = conversations.filter(c => c.id !== id);
    set({
      conversations: newConvs,
      activeId: activeId === id ? (newConvs[0]?.id ?? null) : activeId,
    });
  },

  addMessage: (msg) => {
    const { activeId, conversations, isStreaming } = get();
    let modified: Conversation | null = null;
    const newConvs = conversations.map(c => {
      if (c.id !== activeId) return c;
      const newMessages = [...c.messages, msg];
      const lastMsg = newMessages[newMessages.length - 1];
      const lastMessage = lastMsg ? {
        text: (lastMsg.content || '').slice(0, 100),
        senderName: lastMsg.senderName,
        timestamp: lastMsg.timestamp,
      } : undefined;
      modified = { ...c, messages: newMessages, lastMessage, updatedAt: Date.now() };
      return modified;
    });
    const ordered = modified
      ? newConvs.map(c => c.id === activeId ? modified! : c)
      : newConvs;
    set({ conversations: ordered });
    if (!isStreaming) persistAll(ordered);
  },

  updateLastAssistant: (update, convId?) => {
    const { activeId, conversations, isStreaming } = get();
    const targetId = convId || activeId;
    if (!targetId) return;
    const newConvs = conversations.map(c => {
      if (c.id !== targetId) return c;
      const msgs = [...c.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === 'assistant') {
        msgs[msgs.length - 1] = { ...last, ...update };
      }
      return { ...c, messages: msgs };
    });
    set({ conversations: newConvs });
    if (!isStreaming) persistAll(newConvs);
  },

  newAssistantMessage: (convId?) => {
    const { activeId, conversations } = get();
    const targetId = convId || activeId;
    if (!targetId) return;
    const msg: Message = { id: `msg-${Date.now()}`, role: 'assistant', content: '', timestamp: Date.now() };
    const newConvs = conversations.map(c => {
      if (c.id !== targetId) return c;
      return { ...c, messages: [...c.messages, msg] };
    });
    set({ conversations: newConvs });
  },

  setStreaming: (v) => {
    const wasStreaming = get().isStreaming;
    set({ isStreaming: v });
    if (wasStreaming && !v) persistAll(get().conversations);
  },

  updateTitle: (id, title) => {
    const { conversations, isStreaming } = get();
    const newConvs = conversations.map(c =>
      c.id === id ? { ...c, title } : c
    );
    set({ conversations: newConvs });
    if (!isStreaming) persistAll(newConvs);
  },

  setWebPreviewHtml: (html) => set({ webPreviewHtml: html }),
  setWebPreviewFile: (file) => set({ webPreviewFile: file }),
}));
