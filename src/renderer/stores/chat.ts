import React from 'react';
import { deriveFallbackSessionTitle, extractPlainUserText } from '../utils/sessionTitle';
import type {
  PlanTodoStatus,
  PlanTodo,
  ToolCall,
  Message,
} from '../../common/conversation';
import { useConversationStore } from './conversationStore';
import { useRoleplayStore } from './roleplay';
import { useModeStore } from './mode';

export type { PlanTodoStatus, PlanTodo, ToolCall, Message };

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

export interface Session {
  id: string;
  title: string;
  messages: Message[];
  titlePending?: boolean;
  characterId?: string;
  characterIds?: string[];
  /** @deprecated */
  userCharacterId?: string;
  pendingOpening?: boolean;
  sessionMode?: 'roleplay';
  planTodos?: PlanTodo[];
  planDocPath?: string;
}

function mapConversationToSession(c: any): Session {
  return {
    id: c.id,
    title: c.title,
    messages: c.messages,
    characterId: c.characterId,
    characterIds: c.characterIds,
    userCharacterId: undefined,
    pendingOpening: c.pendingOpening,
    sessionMode: c.sessionMode,
    planTodos: c.planTodos,
    planDocPath: c.planDocPath,
  };
}

function mapState(conv: ReturnType<typeof useConversationStore.getState>) {
  return {
    sessions: conv.conversations.map(mapConversationToSession),
    activeSessionId: conv.activeId,
    isStreaming: conv.isStreaming,
    loadSessions: conv.loadAll,
    createSession: () => {
      const currentMode = useModeStore.getState().mode;
      const isRoleplay = currentMode === 'roleplay';
      conv.createSolo();
      if (isRoleplay) {
        const rp = useRoleplayStore.getState();
        const participantIds = rp.draftParticipantIds.length >= 2
          ? rp.draftParticipantIds
          : rp.activeCharacterId ? [rp.activeCharacterId] : [];
        if (participantIds.length >= 2) {
          conv.setCast(participantIds);
        } else if (participantIds.length === 1) {
          conv.setCharacter(participantIds[0], { sessionMode: 'roleplay', pendingOpening: true });
        }
      }
    },
    switchSession: conv.switchTo,
    deleteSession: conv.delete,
    addMessage: conv.addMessage,
    setStreaming: conv.setStreaming,
    updateLastAssistant: conv.updateLastAssistant,
    newAssistantMessage: conv.newAssistantMessage,
    updateSessionTitle: (id: string, title: string, _titlePending?: boolean) => { conv.updateTitle(id, title); },
    setSessionCharacter: (characterId: string | null, options?: { sessionMode?: 'roleplay'; pendingOpening?: boolean }) => {
      conv.setCharacter(characterId, options);
    },
    setSessionCast: (characterIds: string[]) => {
      conv.setCast(characterIds);
    },
    setPlanTodos: (..._args: any[]) => {},
    clearPlanTodos: (..._args: any[]) => {},
    clearPendingOpening: (convId?: string) => {
      conv.clearPendingOpening(convId);
    },
    webPreviewHtml: conv.webPreviewHtml,
    webPreviewFile: conv.webPreviewFile,
    setWebPreviewHtml: conv.setWebPreviewHtml,
    setWebPreviewFile: conv.setWebPreviewFile,
  };
}

// useChatStore 现在是 conversationStore 的代理
// 只订阅需要的字段，避免 isStreaming 变化导致 sessions 消费者重渲染
// 兼容 zustand selector 模式：useChatStore(s => s.sessions)
type ChatStateMapped = ReturnType<typeof mapState>;

// 提取稳定方法引用，避免 useMemo 因 getState() 返回新对象而失效
function getConvMethods() {
  const c = useConversationStore.getState();
  return {
    loadAll: c.loadAll, createSolo: c.createSolo, switchTo: c.switchTo,
    delete: c.delete, addMessage: c.addMessage, setStreaming: c.setStreaming,
    updateLastAssistant: c.updateLastAssistant, newAssistantMessage: c.newAssistantMessage,
    updateTitle: c.updateTitle, setCharacter: c.setCharacter, setCast: c.setCast,
    clearPendingOpening: c.clearPendingOpening,
    setWebPreviewHtml: c.setWebPreviewHtml, setWebPreviewFile: c.setWebPreviewFile,
  } as const;
}

function useChatStoreImpl<T = ChatStateMapped>(selector?: (state: ChatStateMapped) => T): T {
  const conversations = useConversationStore(s => s.conversations);
  const activeId = useConversationStore(s => s.activeId);
  const isStreaming = useConversationStore(s => s.isStreaming);
  const webPreviewHtml = useConversationStore(s => s.webPreviewHtml);
  const webPreviewFile = useConversationStore(s => s.webPreviewFile);

  // sessions 只在 conversations 变化时重建；isStreaming/webPreview 变化时复用缓存
  const state = React.useMemo<ChatStateMapped>(() => {
    const m = getConvMethods();
    return {
      sessions: conversations.map(mapConversationToSession),
      activeSessionId: activeId,
      isStreaming,
      webPreviewHtml,
      webPreviewFile,
      loadSessions: m.loadAll,
      createSession: () => {
        const currentMode = useModeStore.getState().mode;
        const isRoleplay = currentMode === 'roleplay';
        m.createSolo();
        if (isRoleplay) {
          const rp = useRoleplayStore.getState();
          const participantIds = rp.draftParticipantIds.length >= 2
            ? rp.draftParticipantIds
            : rp.activeCharacterId ? [rp.activeCharacterId] : [];
          if (participantIds.length >= 2) {
            m.setCast(participantIds);
          } else if (participantIds.length === 1) {
            m.setCharacter(participantIds[0], { sessionMode: 'roleplay', pendingOpening: true });
          }
        }
      },
      switchSession: m.switchTo,
      deleteSession: m.delete,
      addMessage: m.addMessage,
      setStreaming: m.setStreaming,
      updateLastAssistant: m.updateLastAssistant,
      newAssistantMessage: m.newAssistantMessage,
      updateSessionTitle: (id: string, title: string) => { m.updateTitle(id, title); },
      setSessionCharacter: (characterId: string | null, options?: { sessionMode?: 'roleplay'; pendingOpening?: boolean }) => {
        m.setCharacter(characterId, options);
      },
      setSessionCast: (characterIds: string[]) => { m.setCast(characterIds); },
      setPlanTodos: () => {},
      clearPlanTodos: () => {},
      clearPendingOpening: (convId?: string) => { m.clearPendingOpening(convId); },
      setWebPreviewHtml: m.setWebPreviewHtml,
      setWebPreviewFile: m.setWebPreviewFile,
    };
  }, [conversations, activeId, isStreaming, webPreviewHtml, webPreviewFile]);

  if (selector) return selector(state);
  return state as unknown as T;
}

// 支持 .getState() 调用（ChatPanel 等组件大量使用）
useChatStoreImpl.getState = () => {
  return mapState(useConversationStore.getState());
};

export const useChatStore = useChatStoreImpl;
export const useChatStoreCompat = useChatStoreImpl;
