import { create } from 'zustand';
import { deriveFallbackSessionTitle, extractPlainUserText } from '../utils/sessionTitle';
import { useRoleplayStore } from './roleplay';
import { useModeStore, type AgentMode } from './mode';

let sessionCounter = 0;

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: string;
  timestamp: number;
  status: 'running' | 'success' | 'error';
}

export interface RoleplayTurnMeta {
  characterId: string;
  characterName: string;
  reply: string;
  status?: Record<string, unknown>;
  statusComplete?: boolean;
}

export interface RoleplayMessageMeta {
  status?: Record<string, unknown>;
  statusComplete?: boolean;
  turns?: RoleplayTurnMeta[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** 多模态用户消息：用于重建 API 历史时保留 image_url */
  contentParts?: Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>;
  thinkingContent?: string;
  toolCalls?: ToolCall[];
  roleplayMeta?: RoleplayMessageMeta;
  /** roleplay 原始流式输出，用于解析失败时的回退 */
  rawContent?: string;
  timestamp: number;
}

export interface Session {
  id: string;
  title: string;
  messages: Message[];
  /** 首轮对话结束后需生成摘要标题 */
  titlePending?: boolean;
  /** 角色扮演：绑定的角色 ID（单角色兼容） */
  characterId?: string;
  /** 群像角色扮演：在场角色 ID 列表 */
  characterIds?: string[];
  /** @deprecated 旧版群聊字段，新会话不再写入 */
  userCharacterId?: string;
  /** 新建 roleplay 会话后待自动生成开场白 */
  pendingOpening?: boolean;
  /** 会话绑定的 Agent 模式（角色相关会话） */
  sessionMode?: 'roleplay';
}

interface ChatState {
  sessions: Session[];
  activeSessionId: string | null;
  isStreaming: boolean;
  loadSessions: () => Promise<void>;
  createSession: () => void;
  clearPendingOpening: (sessionId: string) => void;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  addMessage: (msg: Message) => void;
  setStreaming: (v: boolean) => void;
  updateLastAssistant: (update: Partial<Message>) => void;
  newAssistantMessage: () => void;
  updateSessionTitle: (id: string, title: string, titlePending?: boolean) => void;
  setSessionCharacter: (
    characterId: string | null,
    options?: { sessionMode?: 'roleplay'; pendingOpening?: boolean },
  ) => void;
  setSessionCast: (characterIds: string[]) => void;
}

function parseSessionPayload(raw: string): {
  messages: Message[];
  characterId?: string;
  characterIds?: string[];
  userCharacterId?: string;
  pendingOpening?: boolean;
  sessionMode?: 'roleplay';
} {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { messages: parsed };
    if (parsed && Array.isArray(parsed.messages)) {
      return {
        messages: parsed.messages,
        characterId: parsed.characterId,
        characterIds: parsed.characterIds,
        userCharacterId: parsed.userCharacterId,
        pendingOpening: parsed.pendingOpening,
        sessionMode: parsed.sessionMode === 'dzmm' ? 'roleplay' : parsed.sessionMode,
      };
    }
  } catch { /* fall through */ }
  return { messages: [] };
}

function serializeSessionPayload(session: Session): string {
  return JSON.stringify({
    messages: session.messages,
    characterId: session.characterId,
    characterIds: session.characterIds,
    userCharacterId: session.userCharacterId,
    pendingOpening: session.pendingOpening,
    sessionMode: session.sessionMode,
  });
}

function persistSession(session: Session) {
  window.api.sessions.save(session.id, session.title, serializeSessionPayload(session));
}

function persistAll(sessions: Session[]) {
  for (const s of sessions) persistSession(s);
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  isStreaming: false,

  loadSessions: async () => {
    try {
      const raw = await window.api.sessions.loadAll();
      if (raw && Array.isArray(raw)) {
        const sessions: Session[] = raw.map((r: any) => {
          const payload = parseSessionPayload(r.messages);
          return {
            id: r.id,
            title: r.title,
            messages: payload.messages,
            characterId: payload.characterId,
            characterIds: payload.characterIds,
            userCharacterId: payload.userCharacterId,
            pendingOpening: payload.pendingOpening,
            sessionMode: payload.sessionMode,
          };
        });
        if (sessions.length > 0) {
          const maxCounter = sessions.reduce((max, s) => {
            const match = s.title.match(/会话 #(\d+)/);
            return match ? Math.max(max, parseInt(match[1])) : max;
          }, 0);
          sessionCounter = maxCounter;
          // 只在当前没有激活会话时才设置 activeSessionId，避免后台恢复时切走当前会话
          const currentActive = get().activeSessionId;
          if (currentActive === null || !sessions.find(s => s.id === currentActive)) {
            set({ sessions, activeSessionId: sessions[0].id });
          } else {
            set({ sessions });
          }
        }
      }
    } catch {
      // use empty state on load failure
    }
  },

  createSession: () => {
    sessionCounter++;
    const roleplayState = useRoleplayStore.getState();
    const activeCharacterId = roleplayState.activeCharacterId;
    const draftParticipantIds = roleplayState.draftParticipantIds;
    const currentMode = useModeStore.getState().mode;
    const isRoleplay = currentMode === 'roleplay';
    const useMulti = isRoleplay && draftParticipantIds.length >= 2;
    const participantIds = useMulti
      ? draftParticipantIds
      : activeCharacterId
        ? [activeCharacterId]
        : [];
    const sessionMode: Session['sessionMode'] | undefined = isRoleplay ? 'roleplay' : undefined;
    const session: Session = {
      id: `session-${Date.now()}`,
      title: `会话 #${sessionCounter}`,
      messages: [],
      characterId: participantIds[0],
      characterIds: participantIds.length > 0 ? participantIds : undefined,
      pendingOpening: Boolean(isRoleplay && participantIds.length > 0),
      sessionMode,
    };
    set(s => ({
      sessions: [session, ...s.sessions],
      activeSessionId: session.id,
    }));
    persistSession(session);
  },

  clearPendingOpening: (sessionId) => {
    const { sessions, isStreaming } = get();
    const newSessions = sessions.map(s =>
      s.id === sessionId ? { ...s, pendingOpening: false } : s,
    );
    set({ sessions: newSessions });
    if (!isStreaming) persistAll(newSessions);
  },

  switchSession: (id) => {
    const session = get().sessions.find(s => s.id === id);
    set({ activeSessionId: id });
    const participantIds = session?.characterIds?.length
      ? session.characterIds
      : session?.characterId
        ? [session.characterId]
        : [];
    if (participantIds.length > 0) {
      void useRoleplayStore.getState().setSessionCast(participantIds);
      const targetMode: AgentMode = session?.sessionMode === 'roleplay' || !session?.sessionMode
        ? 'roleplay'
        : useModeStore.getState().mode;
      if (session?.sessionMode === 'roleplay' || participantIds.length > 0) {
        useModeStore.getState().setMode(targetMode);
      }
    }
  },

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
    const { activeSessionId, sessions, isStreaming } = get();
    let modifiedSession: Session | null = null;
    const newSessions = sessions.map(s => {
      if (s.id !== activeSessionId) return s;
      const newMessages = [...s.messages, msg];
      let title = s.title;
      let titlePending = s.titlePending;
      if (s.messages.length === 0 && msg.role === 'user') {
        title = deriveFallbackSessionTitle(extractPlainUserText(msg));
        titlePending = true;
      }
      modifiedSession = { ...s, title, titlePending, messages: newMessages };
      return modifiedSession;
    });
    // 把刚更新的会话移到最前面
    const ordered = modifiedSession
      ? [modifiedSession, ...newSessions.filter(s => s.id !== activeSessionId)]
      : newSessions;
    set({ sessions: ordered });
    if (!isStreaming) persistAll(ordered);
  },

  setStreaming: (v) => {
    const wasStreaming = get().isStreaming;
    set({ isStreaming: v });
    if (wasStreaming && !v) persistAll(get().sessions);
  },

  newAssistantMessage: () => {
    const { activeSessionId, sessions } = get();
    const msg: Message = { id: `msg-${Date.now()}`, role: 'assistant', content: '', timestamp: Date.now() };
    const newSessions = sessions.map(s => {
      if (s.id !== activeSessionId) return s;
      return { ...s, messages: [...s.messages, msg] };
    });
    const ordered = [newSessions.find(s => s.id === activeSessionId)!, ...newSessions.filter(s => s.id !== activeSessionId)];
    set({ sessions: ordered });
  },

  updateLastAssistant: (update) => {
    const { activeSessionId, sessions, isStreaming } = get();
    let modifiedSession: Session | null = null;
    const newSessions = sessions.map(s => {
      if (s.id !== activeSessionId) return s;
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === 'assistant') {
        msgs[msgs.length - 1] = { ...last, ...update };
      }
      modifiedSession = { ...s, messages: msgs };
      return modifiedSession;
    });
    const ordered = modifiedSession
      ? [modifiedSession, ...newSessions.filter(s => s.id !== activeSessionId)]
      : newSessions;
    set({ sessions: ordered });
    if (!isStreaming) persistAll(ordered);
  },

  updateSessionTitle: (id, title, titlePending = false) => {
    const { sessions, isStreaming } = get();
    const newSessions = sessions.map(s =>
      s.id === id ? { ...s, title, titlePending } : s,
    );
    const ordered = [
      newSessions.find(s => s.id === id)!,
      ...newSessions.filter(s => s.id !== id),
    ];
    set({ sessions: ordered });
    if (!isStreaming) persistAll(ordered);
    else {
      const session = ordered.find(s => s.id === id);
      if (session) persistSession(session);
    }
  },

  setSessionCharacter: (characterId, options) => {
    const { activeSessionId, sessions, isStreaming } = get();
    if (!activeSessionId) return;
    const newSessions = sessions.map(s =>
      s.id === activeSessionId
        ? {
            ...s,
            characterId: characterId || undefined,
            characterIds: characterId ? [characterId] : undefined,
            userCharacterId: undefined,
            sessionMode: options?.sessionMode ?? s.sessionMode,
            pendingOpening: options?.pendingOpening ?? (
              characterId && s.messages.length === 0 ? true : s.pendingOpening
            ),
          }
        : s,
    );
    set({ sessions: newSessions });
    if (!isStreaming) persistAll(newSessions);
    else {
      const session = newSessions.find(s => s.id === activeSessionId);
      if (session) persistSession(session);
    }
  },

  setSessionCast: (characterIds) => {
    const { activeSessionId, sessions, isStreaming } = get();
    if (!activeSessionId) return;
    const ids = characterIds.filter(Boolean);
    const newSessions = sessions.map(s =>
      s.id === activeSessionId
        ? {
            ...s,
            characterIds: ids.length > 0 ? ids : undefined,
            characterId: ids[0],
            userCharacterId: undefined,
            pendingOpening: ids.length > 0 ? s.pendingOpening : false,
          }
        : s,
    );
    set({ sessions: newSessions });
    if (!isStreaming) persistAll(newSessions);
    else {
      const session = newSessions.find(s => s.id === activeSessionId);
      if (session) persistSession(session);
    }
  },
}));
