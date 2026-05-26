import { describe, it, expect } from 'vitest';
import {
  fuzzyScore,
  matchesFilter,
  scoreNode,
  searchWorkspace,
  wildcardToRegex,
  mergeQuickOpenResults,
  shouldSearchContent,
} from '../quickOpenSearch';
import { FileNode } from '../../../stores/files';

const tree: FileNode[] = [
  {
    name: 'src',
    path: 'D:/proj/src',
    isDirectory: true,
    children: [
      { name: 'main.ts', path: 'D:/proj/src/main.ts', isDirectory: false },
      { name: 'readme.md', path: 'D:/proj/src/readme.md', isDirectory: false },
      { name: 'logo.png', path: 'D:/proj/src/logo.png', isDirectory: false },
    ],
  },
  { name: 'assets', path: 'D:/proj/assets', isDirectory: true, children: [] },
];

describe('quickOpenSearch', () => {
  it('should match wildcard patterns', () => {
    expect(wildcardToRegex('main.*')?.test('main.ts')).toBe(true);
    expect(wildcardToRegex('logo.p?g')?.test('logo.png')).toBe(true);
  });

  it('should fuzzy score subsequence matches', () => {
    expect(fuzzyScore('mt', 'main.ts')).toBeGreaterThan(0);
    expect(fuzzyScore('xyz', 'main.ts')).toBe(-1);
  });

  it('should filter by type', () => {
    const file = tree[0].children![0];
    expect(matchesFilter(file, 'code')).toBe(true);
    expect(matchesFilter(file, 'image')).toBe(false);
    expect(matchesFilter(tree[1], 'folder')).toBe(true);
  });

  it('should search workspace with filter and wildcard', () => {
    const wildcardResults = searchWorkspace(tree, 'logo.*', 'image');
    expect(wildcardResults).toHaveLength(1);
    expect(wildcardResults[0].node.name).toBe('logo.png');

    const codeResults = searchWorkspace(tree, 'main', 'code');
    expect(codeResults.some(item => item.node.name === 'main.ts')).toBe(true);
  });

  it('should score node by fuzzy name', () => {
    expect(scoreNode('readme', tree[0].children![1])).toBeGreaterThan(0);
  });

  it('should merge path and content results without duplicate files', () => {
    const pathResults = searchWorkspace(tree, 'main', 'code');
    const contentResults = [{
      path: 'D:/proj/src/main.ts',
      name: 'main.ts',
      line: 12,
      preview: 'function main() {}',
      score: 120,
    }];
    const merged = mergeQuickOpenResults(pathResults, contentResults);
    expect(merged[0].type).toBe('content');
    expect(merged.some(item => item.type === 'file' && item.node.path === 'D:/proj/src/main.ts')).toBe(false);
  });

  it('should enable content search for code and all filters', () => {
    expect(shouldSearchContent('code', 'abc')).toBe(true);
    expect(shouldSearchContent('all', 'abc')).toBe(true);
    expect(shouldSearchContent('folder', 'abc')).toBe(false);
    expect(shouldSearchContent('code', 'a')).toBe(false);
  });
});
