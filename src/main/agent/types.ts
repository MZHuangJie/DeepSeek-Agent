export interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string; detail?: 'auto' | 'low' | 'high' };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  reasoning_content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolCallResult {
  id: string;
  name: string;
  arguments: string;
}

export interface StreamResult {
  content: string;
  thinking: string;
  toolCalls: ToolCallResult[];
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  usage?: TokenUsage;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export type FinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter';
