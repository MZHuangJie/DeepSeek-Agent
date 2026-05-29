import { describe, expect, it } from 'vitest';
import { resolveEffectiveCast, resolveSessionCast } from '../roleplay-multi';

describe('resolveEffectiveCast', () => {
  it('falls back to activeCharacterId when session has no cast', () => {
    const cast = resolveEffectiveCast({ id: 's1', title: 't', messages: [] }, 'char-1', 'roleplay');
    expect(cast.participantIds).toEqual(['char-1']);
    expect(cast.isMulti).toBe(false);
  });

  it('prefers session cast over activeCharacterId', () => {
    const cast = resolveEffectiveCast(
      { characterId: 'session-char', messages: [] },
      'active-char',
      'roleplay',
    );
    expect(cast.participantIds).toEqual(['session-char']);
  });

  it('does not fallback in agent mode', () => {
    const cast = resolveEffectiveCast(undefined, 'char-1', 'agent');
    expect(resolveSessionCast(undefined).participantIds).toEqual([]);
    expect(cast.participantIds).toEqual([]);
  });
});
