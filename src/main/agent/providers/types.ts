export interface ParseState {
  content: string;
  thinking: string;
  finishReason?: string;
  usage?: {
    prompt_tokens: number; completion_tokens: number; total_tokens: number;
    prompt_cache_hit_tokens?: number;
    prompt_cache_miss_tokens?: number;
  };
  /** Accumulated tool calls keyed by index (streaming deltas) */
  toolCallsAccum: Map<number, { id: string; name: string; arguments: string }>;
  lastToolCallIndex: number;
}

export interface StreamResult {
  content: string;
  thinking: string;
  toolCalls: Array<{ id: string; name: string; arguments: string }>;
  finishReason?: string;
  usage?: {
    prompt_tokens: number; completion_tokens: number; total_tokens: number;
    prompt_cache_hit_tokens?: number;
    prompt_cache_miss_tokens?: number;
  };
}

export interface StreamCallbacks {
  onContent: (text: string) => void;
  onThinking: (text: string) => void;
}

export interface Provider {
  /** Called for each SSE data chunk during streaming */
  parseChunk(data: unknown, state: ParseState, callbacks: StreamCallbacks): void;
  /** Called after stream ends — does any final cleanup / extraction */
  finalize(state: ParseState): void;
  /** Optional: transform the accumulated result after stream ends */
  postProcess?(state: ParseState): void;
  /** Check if tool calls should be flushed after this chunk */
  shouldFlush(data: unknown): boolean;
}

export function createParseState(): ParseState {
  return {
    content: '',
    thinking: '',
    toolCallsAccum: new Map(),
    lastToolCallIndex: -1,
  };
}
