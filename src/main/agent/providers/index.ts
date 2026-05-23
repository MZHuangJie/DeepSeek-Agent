import type { Provider } from './types';
import { openaiProvider } from './openai';
import { anthropicProvider } from './anthropic';

export type { Provider, ParseState, StreamCallbacks, StreamResult } from './types';
export { openaiProvider } from './openai';
export { anthropicProvider } from './anthropic';
export { createParseState } from './types';

export function selectProvider(model: string, baseUrl: string): Provider {
  if (
    baseUrl.includes('anthropic.com') ||
    model.toLowerCase().includes('claude')
  ) {
    return anthropicProvider;
  }
  return openaiProvider;
}
