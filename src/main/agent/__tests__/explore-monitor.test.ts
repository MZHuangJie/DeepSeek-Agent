import { describe, it, expect } from 'vitest';
import { shouldContinueExplore, buildExploreNudge, buildExploreCompletionNudge } from '../explore-monitor';

function makeState(overrides: Partial<{ readPercentage: number; unreadLen: number; readFileCount: number; totalFiles: number }> = {}) {
  return {
    readFileCount: overrides.readFileCount ?? 5,
    totalFiles: overrides.totalFiles ?? 50,
    readFiles: new Set<string>(),
    readPercentage: overrides.readPercentage ?? 10,
    unreadFiles: Array.from({ length: overrides.unreadLen ?? 45 }, (_, i) => `src/module${i}/file${i}.ts`),
    totalToolCalls: 3,
  };
}

describe('shouldContinueExplore', () => {
  it('should continue when below 80% and has unread files', () => {
    expect(shouldContinueExplore(makeState({ readPercentage: 50, unreadLen: 20 }))).toBe(true);
  });

  it('should stop when above 80%', () => {
    expect(shouldContinueExplore(makeState({ readPercentage: 85, unreadLen: 5 }))).toBe(false);
  });

  it('should stop when no unread files', () => {
    expect(shouldContinueExplore(makeState({ readPercentage: 10, unreadLen: 0 }))).toBe(false);
  });
});

describe('buildExploreNudge', () => {
  it('should contain progress info', () => {
    const state = makeState({ readFileCount: 5, totalFiles: 50, readPercentage: 10, unreadLen: 45 });
    const msg = buildExploreNudge(state, 1, 50);
    expect(msg).toContain('进度检查');
    expect(msg).toContain('5/50');
    expect(msg).toContain('10%');
  });

  it('should include unread directories', () => {
    const state = {
      ...makeState(),
      unreadFiles: ['src/main/file1.ts', 'src/main/file2.ts', 'src/renderer/file3.ts'],
      readPercentage: 10,
      totalFiles: 10,
      readFileCount: 1,
    };
    const msg = buildExploreNudge(state, 0, 50);
    expect(msg).toContain('src/main');
  });
});

describe('buildExploreCompletionNudge', () => {
  it('should request full analysis', () => {
    const state = makeState({ readPercentage: 85 });
    const msg = buildExploreCompletionNudge(state);
    expect(msg).toContain('项目架构');
    expect(msg).toContain('模块功能');
  });
});
