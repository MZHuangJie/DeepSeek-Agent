import { describe, it, expect } from 'vitest';
import { matchesContentQuery, searchWorkspaceContent } from '../contentSearch';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('contentSearch', () => {
  it('should match literal and wildcard content queries', () => {
    expect(matchesContentQuery('handleSelect', 'const handleSelect = () => {}')).toBe(true);
    expect(matchesContentQuery('foo', 'const bar = 1')).toBe(false);
    expect(matchesContentQuery('handle*', 'function handleOpen() {}')).toBe(true);
  });

  it('should search workspace file contents', async () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'mycli-search-'));
    const srcDir = path.join(workspace, 'src');
    fs.mkdirSync(srcDir);
    fs.writeFileSync(path.join(srcDir, 'main.ts'), 'export function helloWorld() {\n  return 1;\n}\n');
    fs.writeFileSync(path.join(srcDir, 'util.ts'), 'export const value = 42;\n');

    const results = await searchWorkspaceContent(workspace, 'helloWorld', 'code', [
      path.join(srcDir, 'main.ts'),
      path.join(srcDir, 'util.ts'),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].line).toBe(1);
    expect(results[0].preview).toContain('helloWorld');

    fs.rmSync(workspace, { recursive: true, force: true });
  });
});
