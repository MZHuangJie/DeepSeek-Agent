import { describe, it, expect } from 'vitest';
import {
  PORTRAIT_STYLE_OPTIONS,
  PORTRAIT_STYLE_GROUPS,
  DEFAULT_PORTRAIT_STYLE,
  resolvePortraitStyle,
  getPortraitStylesByGroup,
} from '../portrait-styles';

describe('portrait styles', () => {
  it('has default 2D anime style', () => {
    expect(DEFAULT_PORTRAIT_STYLE).toBe('anime-2d');
    expect(resolvePortraitStyle().label).toContain('2D 动漫');
  });

  it('resolves known style ids', () => {
    expect(resolvePortraitStyle('realistic').label).toBe('真人写实');
    expect(resolvePortraitStyle('cyberpunk').promptHint).toContain('cyberpunk');
    expect(resolvePortraitStyle('chinese-ink').promptHint).toContain('ink wash');
  });

  it('falls back for unknown style', () => {
    expect(resolvePortraitStyle('unknown-style').id).toBe('anime-2d');
  });

  it('lists unique style options with groups', () => {
    const ids = PORTRAIT_STYLE_OPTIONS.map(o => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(PORTRAIT_STYLE_OPTIONS.length).toBeGreaterThanOrEqual(40);
    for (const group of PORTRAIT_STYLE_GROUPS) {
      expect(getPortraitStylesByGroup(group).length).toBeGreaterThan(0);
    }
    const grouped = PORTRAIT_STYLE_GROUPS.flatMap(g => getPortraitStylesByGroup(g));
    expect(grouped.length).toBe(PORTRAIT_STYLE_OPTIONS.length);
  });
});
