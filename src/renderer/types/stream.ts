/**
 * 流式输出相关类型定义
 * 用于 useStreamHandler / ChatPanel / IPC 通信
 */

/** Agent 流式消息块（主进程 → 渲染进程 IPC） */
export type StreamChunk =
  | { type: 'content'; text: string; sessionId?: string; step?: number; total?: number }
  | { type: 'thinking'; text: string; sessionId?: string; step?: number; total?: number }
  | { type: 'tool-call'; name: string; args: string; sessionId?: string; step?: number; total?: number }
  | { type: 'tool-result'; name: string; result: string; status: 'success' | 'error'; sessionId?: string; step?: number; total?: number }
  | { type: 'usage'; prompt: number; completion: number; total: number; toolTokens?: number; currentPrompt?: number; contextMax?: number; sessionId?: string }
  | { type: 'done'; sessionId?: string }
  | { type: 'error'; message: string; sessionId?: string }
  | { type: 'explore-progress'; readPercentage: number; readFileCount: number; totalFiles: number; step?: number; total?: number; sessionId?: string }
  | { type: 'explore-warning'; warning: string; sessionId?: string }
  | { type: 'sub-agent-start'; taskId: string; subAgentType: 'explore' | 'analyze' | 'implement' | 'review'; description: string; targetPath: string; waveIndex?: number; sessionId?: string }
  | { type: 'sub-agent-chunk'; taskId: string; chunkType: string; text: string; sessionId?: string }
  | { type: 'sub-agent-tool-call'; taskId: string; name: string; args: string; sessionId?: string }
  | { type: 'sub-agent-usage'; taskId: string; prompt: number; completion: number; total: number; sessionId?: string }
  | { type: 'sub-agent-complete'; taskId: string; success: boolean; summary?: string; filesProcessed?: number; tokenUsage?: { prompt: number; completion: number; total: number }; error?: string; sessionId?: string }
  | { type: 'sub-agent-error'; taskId: string; error: string; sessionId?: string }
  | { type: 'plan-todos'; todos: Array<{ id?: string; content: string; status: string; plan_doc_path?: string }>; planDocPath?: string; sessionId?: string }
  | { type: 'web-preview'; html: string; file?: string; sessionId?: string };

/** 发送给 Agent 的历史消息条目 */
export interface HistoryEntry {
  role: 'user' | 'assistant' | 'tool';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  reasoning_content?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

/** 从持久化存储中加载的原始会话行 */
export interface RawConversationRow {
  id: string;
  title: string;
  payload: string;
}
