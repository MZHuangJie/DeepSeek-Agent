import { deriveFallbackSessionTitle, extractPlainUserText } from '../utils/sessionTitle';
import type {
  PlanTodoStatus,
  PlanTodo,
  ToolCall,
  Message,
} from '../../common/conversation';
import { useConversationStore } from './conversationStore';

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
    createSession: conv.createSolo,
    switchSession: conv.switchTo,
    deleteSession: conv.delete,
    addMessage: conv.addMessage,
    setStreaming: conv.setStreaming,
    updateLastAssistant: conv.updateLastAssistant,
    newAssistantMessage: conv.newAssistantMessage,
    updateSessionTitle: (id: string, title: string, _titlePending?: boolean) => { conv.updateTitle(id, title); },
    setSessionCharacter: (..._args: any[]) => {},
    setSessionCast: (..._args: any[]) => {},
    setPlanTodos: (..._args: any[]) => {},
    clearPlanTodos: (..._args: any[]) => {},
    clearPendingOpening: (..._args: any[]) => {},
    webPreviewHtml: conv.webPreviewHtml,
    webPreviewFile: conv.webPreviewFile,
    setWebPreviewHtml: conv.setWebPreviewHtml,
    setWebPreviewFile: conv.setWebPreviewFile,
  };
}

// useChatStore 现在是 conversationStore 的代理
// 所有组件透明地通过旧接口读写 conversationStore
// 兼容 zustand selector 模式：useChatStore(s => s.sessions)
type ChatStateMapped = ReturnType<typeof mapState>;
function useChatStoreImpl<T = ChatStateMapped>(selector?: (state: ChatStateMapped) => T): T {
  const conv = useConversationStore();
  const state = mapState(conv);
  if (selector) return selector(state);
  return state as unknown as T;
}

// 支持 .getState() 调用（ChatPanel 等组件大量使用）
useChatStoreImpl.getState = () => {
  return mapState(useConversationStore.getState());
};

export const useChatStore = useChatStoreImpl;
export const useChatStoreCompat = useChatStoreImpl;
