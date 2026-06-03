// src/renderer/stores/conversationStore.ts
import { create } from 'zustand';
import type { Conversation, ConversationMember, ConversationType, Message, DriverConfig } from '../../common/conversation';
import type { RawConversationRow } from '../types/stream';
import { useModeStore } from './mode';
import type { AgentRole } from './agentRoles';

export interface CloudSessionDeps {
  sessionId: string;
  sessionTitle: string;
  payload: string;
  missingAgents: ConversationMember[];  // members with roleType === 'agent', not in local roles
  missingNpcIds: string[];              // characterIds not in local roleplay store
  cloudNpcIds: string[];                // subset of missingNpcIds that exist on cloud
  unrecoverableNpcIds: string[];        // not local, not on cloud
}

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

const CLOUD_PUSH_DEBOUNCE = new Map<string, ReturnType<typeof setTimeout>>();

function persistConversation(conv: Conversation) {
  window.api.conversations.save(conv.id, conv.title, serializeConversation(conv));
  // 防抖推送到云端（避免频繁消息更新时重复请求）
  const existing = CLOUD_PUSH_DEBOUNCE.get(conv.id);
  if (existing) clearTimeout(existing);
  CLOUD_PUSH_DEBOUNCE.set(conv.id, setTimeout(() => {
    CLOUD_PUSH_DEBOUNCE.delete(conv.id);
    window.api.sync.pushSession(conv.id, conv.title, serializeConversation(conv))
      .catch(() => {}); // 静默失败，登录状态会自然阻止
  }, 3000));
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

  setCharacter: (characterId: string | null, options?: { sessionMode?: 'roleplay'; pendingOpening?: boolean }) => void;
  setCast: (characterIds: string[]) => void;
  clearPendingOpening: (convId?: string) => void;

  // 云端恢复
  checkCloudSessionDeps: (sessionId: string) => Promise<CloudSessionDeps | null>;
  restoreCloudSession: (sessionId: string) => Promise<Conversation | null>;

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
        const conversations: Conversation[] = raw.map((r: RawConversationRow) => {
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
    // 同时删除云端副本
    window.api.sync.deleteSession(id).catch(() => {});
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

  setCharacter: (characterId, options) => {
    const { activeId, conversations, isStreaming } = get();
    if (!activeId) return;
    const newConvs = conversations.map(c =>
      c.id === activeId
        ? {
            ...c,
            characterId: characterId || undefined,
            characterIds: characterId ? [characterId] : undefined,
            sessionMode: options?.sessionMode ?? c.sessionMode,
            pendingOpening: options?.pendingOpening ?? (
              characterId && c.messages.length === 0 ? true : c.pendingOpening
            ),
          }
        : c,
    );
    set({ conversations: newConvs });
    if (!isStreaming) {
      const updated = newConvs.find(c => c.id === activeId);
      if (updated) persistConversation(updated);
    }
  },

  setCast: (characterIds) => {
    const { activeId, conversations, isStreaming } = get();
    if (!activeId) return;
    const ids = characterIds.filter(Boolean);
    const isRoleplay = useModeStore.getState().mode === 'roleplay';
    const newConvs = conversations.map(c =>
      c.id === activeId
        ? {
            ...c,
            characterIds: ids.length > 0 ? ids : undefined,
            characterId: ids[0],
            sessionMode: isRoleplay ? 'roleplay' as const : c.sessionMode,
            pendingOpening: ids.length > 0 && c.messages.length === 0 ? true : (ids.length > 0 ? c.pendingOpening : false),
          }
        : c,
    );
    set({ conversations: newConvs });
    if (!isStreaming) {
      const updated = newConvs.find(c => c.id === activeId);
      if (updated) persistConversation(updated);
    }
  },

  clearPendingOpening: (convId?) => {
    const { activeId, conversations, isStreaming } = get();
    const targetId = convId || activeId;
    if (!targetId) return;
    const newConvs = conversations.map(c =>
      c.id === targetId ? { ...c, pendingOpening: false } : c,
    );
    set({ conversations: newConvs });
    if (!isStreaming) {
      const updated = newConvs.find(c => c.id === targetId);
      if (updated) persistConversation(updated);
    }
  },

  checkCloudSessionDeps: async (sessionId) => {
    try {
      const res = await window.api.sync.getSession(sessionId);
      if (!res?.session?.payload) return null;
      const parsed = parseConversationPayload(res.session.payload);
      const { useAgentRolesStore } = await import('./agentRoles');
      const { useRoleplayStore } = await import('./roleplay');
      const localRoles = useAgentRolesStore.getState().roles;
      const localChars = useRoleplayStore.getState().characters;

      // 检测缺失的 Agent 角色
      const agentMembers = (parsed.members || []).filter(m => m.roleType === 'agent');
      const missingAgents = agentMembers.filter(m => {
        if (!m.roleId) return true;
        return !localRoles.some(r => r.id === m.roleId);
      });

      // 检测缺失的 NPC
      const allCharIds = [
        ...(parsed.characterIds || []),
        ...(parsed.characterId ? [parsed.characterId] : []),
      ].filter(Boolean);
      const uniqueIds = [...new Set(allCharIds)];
      const missingNpcIds = uniqueIds.filter(id => !localChars.some(c => c.id === id));

      // 检查云端是否有这些 NPC
      const cloudNpcIds: string[] = [];
      const unrecoverableNpcIds: string[] = [];
      for (const id of missingNpcIds) {
        try {
          const charRes = await window.api.sync.getCharacter(id);
          if (charRes?.character?.payload) {
            cloudNpcIds.push(id);
          } else {
            unrecoverableNpcIds.push(id);
          }
        } catch {
          unrecoverableNpcIds.push(id);
        }
      }

      return {
        sessionId,
        sessionTitle: res.session.title || '',
        payload: res.session.payload,
        missingAgents,
        missingNpcIds,
        cloudNpcIds,
        unrecoverableNpcIds,
      };
    } catch {
      return null;
    }
  },

  restoreCloudSession: async (sessionId) => {
    try {
      const res = await window.api.sync.getSession(sessionId);
      if (!res?.session?.payload) return null;
      const parsed = parseConversationPayload(res.session.payload);
      const conv: Conversation = {
        id: sessionId,
        title: res.session.title || sessionId,
        type: parsed.type,
        members: parsed.members,
        messages: parsed.messages,
        lastMessage: parsed.lastMessage,
        driver: parsed.driver,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        characterId: parsed.characterId,
        characterIds: parsed.characterIds,
        planTodos: parsed.planTodos,
        planDocPath: parsed.planDocPath,
        pendingOpening: parsed.pendingOpening,
        sessionMode: parsed.sessionMode,
      };
      persistConversation(conv);
      set(s => ({
        conversations: [conv, ...s.conversations.filter(c => c.id !== conv.id)],
      }));
      return conv;
    } catch {
      return null;
    }
  },
}));
