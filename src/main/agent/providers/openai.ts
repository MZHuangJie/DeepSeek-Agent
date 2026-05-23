import type { Provider, ParseState, StreamCallbacks } from './types';

/**
 * OpenAI-compatible streaming provider.
 * Works with: OpenAI, DeepSeek, Qwen, Zhipu, Moonshot, Gemini (OpenAI compat), and most 中转站.
 */
export const openaiProvider: Provider = {
  shouldFlush(data: unknown): boolean {
    const d = data as Record<string, unknown>;
    const choices = d.choices as Array<Record<string, unknown>> | undefined;
    const fr = choices?.[0]?.finish_reason as string | undefined;
    return fr === 'tool_calls' || fr === 'stop' || fr === 'length';
  },

  parseChunk(data: unknown, state: ParseState, callbacks: StreamCallbacks): void {
    const chunk = data as Record<string, unknown>;

    if (chunk.usage) {
      state.usage = chunk.usage as ParseState['usage'];
    }

    const choice = (chunk.choices as Array<Record<string, unknown>>)?.[0];
    if (!choice) return;

    const delta = choice.delta as Record<string, unknown> | undefined;

    if (delta?.reasoning_content && typeof delta.reasoning_content === 'string') {
      state.thinking += delta.reasoning_content;
      callbacks.onThinking(delta.reasoning_content);
    }

    if (delta?.content && typeof delta.content === 'string') {
      state.content += delta.content;
      callbacks.onContent(delta.content);
    }

    // Standard OpenAI streaming tool_calls in delta
    if (delta?.tool_calls && Array.isArray(delta.tool_calls)) {
      for (const tc of delta.tool_calls as Array<Record<string, unknown>>) {
        const idx = (tc.index as number) ?? 0;
        const existing = state.toolCallsAccum.get(idx) || { id: '', name: '', arguments: '' };
        if (tc.id && typeof tc.id === 'string') existing.id = tc.id;
        const fn = tc.function as Record<string, unknown> | undefined;
        if (fn?.name && typeof fn.name === 'string') existing.name = fn.name;
        if (fn?.arguments) existing.arguments += typeof fn.arguments === 'string' ? fn.arguments : '';
        state.toolCallsAccum.set(idx, existing);
        state.lastToolCallIndex = Math.max(state.lastToolCallIndex, idx);
      }
    }

    // Non-streaming tool_calls (some APIs return them in the last chunk's message)
    const message = choice.message as Record<string, unknown> | undefined;
    if (message?.tool_calls && Array.isArray(message.tool_calls)) {
      for (const tc of message.tool_calls as Array<Record<string, unknown>>) {
        const fn = tc.function as Record<string, unknown> | undefined;
        if (fn?.name) {
          const idx = state.toolCallsAccum.size;
          state.toolCallsAccum.set(idx, {
            id: (tc.id as string) || `call_${idx}`,
            name: fn.name as string,
            arguments: typeof fn.arguments === 'string' ? fn.arguments : JSON.stringify(fn.arguments || {}),
          });
          state.lastToolCallIndex = Math.max(state.lastToolCallIndex, idx);
        }
      }
    }

    if (choice.finish_reason && typeof choice.finish_reason === 'string') {
      state.finishReason = choice.finish_reason;
    }
  },

  finalize(_state: ParseState): void {
    // no post-processing needed for standard OpenAI format
  },
};
