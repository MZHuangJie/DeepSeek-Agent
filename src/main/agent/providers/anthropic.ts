import type { Provider, ParseState, StreamCallbacks } from './types';

/**
 * Anthropic Claude provider.
 * Claude often returns tools differently from standard OpenAI format:
 * 1. ```tool code blocks (text emulation)
 * 2. Raw JSON: {"name": "...", "arguments": {...}} on its own line
 * 3. Native: tool_use JSON blocks embedded in content
 *
 * This provider first delegates to standard OpenAI parsing, then post-processes
 * the content for Anthropic-specific tool formats.
 */
export const anthropicProvider: Provider = {
  shouldFlush(data: unknown): boolean {
    const d = data as Record<string, unknown>;
    const choices = d.choices as Array<Record<string, unknown>> | undefined;
    const fr = choices?.[0]?.finish_reason as string | undefined;
    return fr === 'tool_calls' || fr === 'stop' || fr === 'length' || fr === 'end_turn';
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

    // Standard streaming tool_calls (for proxies that translate correctly)
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

    if (choice.finish_reason && typeof choice.finish_reason === 'string') {
      state.finishReason = choice.finish_reason;
    }
  },

  finalize(state: ParseState): void {
    // If we already have proper tool_calls from streaming, nothing to do
    if (state.toolCallsAccum.size > 0) return;

    // Try to extract tool calls from the accumulated content text
    if (!state.content) return;

    const parsed = extractTextTools(state.content);
    if (parsed.length > 0) {
      for (const tc of parsed) {
        const idx = state.toolCallsAccum.size;
        state.toolCallsAccum.set(idx, tc);
        state.lastToolCallIndex = Math.max(state.lastToolCallIndex, idx);
      }
      // Clean up the content: remove tool blocks, raw JSON calls, colon-wrapped, XML, and fake results
      state.content = state.content
        .replace(/```tool\s*\n\{[\s\S]*?\}\s*\n```/g, '')
        .replace(/\{\s*"name"\s*:\s*"[^"]+"\s*,\s*"arguments"\s*:\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}\s*\}/g, '')
        .replace(/::[a-z_]\w*::\s*\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/gi, '')
        .replace(/<tool_call>\s*\{[\s\S]*?\}\s*<\/tool_call>/gi, '')
        .replace(/\{\s*"tool_name"\s*:\s*"[^"]+"\s*,\s*"result"\s*:\s*[\s\S]*?\n\}/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }
  },
};

function extractTextTools(content: string): Array<{ id: string; name: string; arguments: string }> {
  const result: Array<{ id: string; name: string; arguments: string }> = [];

  // Format 1: ```tool\n{"name": "...", "arguments": {...}}\n```  (text emulation)
  const codeBlockRegex = /```tool\s*\n(\{[\s\S]*?\})\s*\n```/g;
  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.name) {
        result.push({
          id: `ct_${result.length}`,
          name: parsed.name,
          arguments: typeof parsed.arguments === 'string'
            ? parsed.arguments
            : JSON.stringify(parsed.arguments || {}),
        });
      }
    } catch { /* skip malformed JSON */ }
  }

  // Format 2: raw JSON on its own line {"name": "...", "arguments": {...}}
  if (result.length === 0) {
    // Match {"name": "tool_name", "arguments": { ... }} with balanced braces
    const rawJsonRegex = /\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*(\{[^}]*(?:\{[^}]*\}[^}]*)*\})\s*\}/g;
    while ((match = rawJsonRegex.exec(content)) !== null) {
      try {
        const parsedArgs = JSON.parse(match[2]);
        result.push({
          id: `rj_${result.length}`,
          name: match[1],
          arguments: typeof parsedArgs === 'string' ? parsedArgs : JSON.stringify(parsedArgs),
        });
      } catch { /* skip malformed JSON */ }
    }
  }

  // Format 3: Anthropic native tool_use blocks
  if (result.length === 0) {
    const toolUseRegex = /\{\s*"type"\s*:\s*"tool_use"\s*,\s*"id"\s*:\s*"([^"]+)"\s*,\s*"name"\s*:\s*"([^"]+)"\s*,\s*"input"\s*:\s*(\{[^}]+\})\s*\}/g;
    while ((match = toolUseRegex.exec(content)) !== null) {
      try {
        const input = JSON.parse(match[3]);
        result.push({ id: match[1], name: match[2], arguments: JSON.stringify(input) });
      } catch {
        result.push({ id: match[1], name: match[2], arguments: match[3] });
      }
    }
  }

  // Format 4: ::tool_name::{"key": "value", ...} (Claude pseudo-syntax via OpenAI-compat proxies)
  if (result.length === 0) {
    const colonWrappedRegex = /::([a-z_]\w*)::\s*(\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})/gi;
    while ((match = colonWrappedRegex.exec(content)) !== null) {
      try {
        const args = JSON.parse(match[2]);
        result.push({ id: `cw_${result.length}`, name: match[1], arguments: JSON.stringify(args) });
      } catch { /* skip malformed JSON */ }
    }
  }

  // Format 5: <tool_call>{"name": "...", "arguments": {...}}</tool_call> (Anthropic XML style)
  if (result.length === 0) {
    const xmlToolCallRegex = /<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/gi;
    while ((match = xmlToolCallRegex.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.name) {
          result.push({
            id: `xml_${result.length}`,
            name: parsed.name,
            arguments: typeof parsed.arguments === 'string'
              ? parsed.arguments
              : JSON.stringify(parsed.arguments || {}),
          });
        }
      } catch { /* skip malformed JSON */ }
    }
  }

  return result;
}
