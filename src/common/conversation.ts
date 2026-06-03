// src/common/conversation.ts
// Shared Conversation types for main and renderer processes

export type ConversationType = 'solo' | 'group_npc' | 'group_agent';

export type PlanTodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface PlanTodo {
  id: string;
  content: string;
  status: PlanTodoStatus;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: string;
  timestamp: number;
  status: 'running' | 'success' | 'error';
}

export interface ConversationMember {
  roleId: string;
  roleType: 'agent' | 'npc';
  name: string;
  avatar?: string;
  modelId?: string;
  systemPrompt: string;
}

export interface DriverConfig {
  mode: 'simple' | 'director';
  directorModel?: { model: string; baseUrl: string };
  maxRounds: number; // 默认 8
}

export interface LastMessagePreview {
  text: string;
  senderName?: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  title: string;
  avatar?: string;
  members: ConversationMember[];
  messages: Message[];
  lastMessage?: LastMessagePreview;
  driver: DriverConfig;
  createdAt: number;
  updatedAt: number;
  // Backward compatibility
  characterId?: string;
  characterIds?: string[];
  planTodos?: PlanTodo[];
  planDocPath?: string;
  pendingOpening?: boolean;
  sessionMode?: 'roleplay';
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  contentParts?: Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>;
  thinkingContent?: string;
  toolCalls?: ToolCall[];
  roleplayMeta?: Record<string, unknown>;
  rawContent?: string;
  timestamp: number;
  // Group chat extensions
  senderId?: string;
  senderName?: string;
  senderAvatar?: string;
}

export interface GroupChunk {
  type: 'director-thinking' | 'typing' | 'text' | 'message-done' | 'group-done' | 'error' | 'usage';
  speaker?: { roleId: string; name: string; avatar?: string };
  text?: string;
  reply?: string;
  message?: string;
  usage?: {
    prompt: number; completion: number; total: number;
    promptCacheHit?: number; promptCacheMiss?: number;
    modelName?: string;
  };
}

export interface MemberInfo {
  roleId: string;
  name: string;
  avatar?: string;
}
