import { describe, it, expect } from 'vitest';
import { parsePorcelainStatus } from '../git';

describe('parsePorcelainStatus', () => {
  it('should parse branch and file sections', () => {
    const parsed = parsePorcelainStatus([
      '## main...origin/main [ahead 2, behind 1]',
      'M  src/staged.ts',
      ' M src/unstaged.ts',
      '?? new-file.ts',
    ].join('\n'));

    expect(parsed.branch).toBe('main');
    expect(parsed.upstream).toBe('origin/main');
    expect(parsed.ahead).toBe(2);
    expect(parsed.behind).toBe(1);
    expect(parsed.staged).toEqual([{ path: 'src/staged.ts', status: 'M' }]);
    expect(parsed.unstaged).toEqual([{ path: 'src/unstaged.ts', status: 'M' }]);
    expect(parsed.untracked).toEqual([{ path: 'new-file.ts', status: '?' }]);
    expect(parsed.hasUpstream).toBe(true);
    expect(parsed.clean).toBe(false);
  });

  it('should parse detached HEAD and conflicts', () => {
    const parsed = parsePorcelainStatus([
      '## HEAD (no branch)',
      'UU conflict.ts',
    ].join('\n'));
    expect(parsed.detached).toBe(true);
    expect(parsed.hasUpstream).toBe(false);
    expect(parsed.conflicts).toEqual([{ path: 'conflict.ts', status: 'UU' }]);
  });

  it('should mark clean repo', () => {
    const parsed = parsePorcelainStatus('## develop');
    expect(parsed.clean).toBe(true);
    expect(parsed.hasUpstream).toBe(false);
  });
});
