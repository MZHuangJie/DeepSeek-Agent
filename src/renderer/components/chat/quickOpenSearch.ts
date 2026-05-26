import { FileNode } from '../../stores/files';

export type SearchFilter = 'all' | 'file' | 'folder' | 'code' | 'image' | 'document';

export const SEARCH_FILTERS: Array<{ id: SearchFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'file', label: '文件' },
  { id: 'folder', label: '文件夹' },
  { id: 'code', label: '代码' },
  { id: 'image', label: '图片' },
  { id: 'document', label: '文档' },
];

const CODE_EXTS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'hpp',
  'cs', 'php', 'rb', 'swift', 'kt', 'dart', 'lua', 'sh', 'bash', 'zsh', 'ps1', 'sql', 'vue', 'svelte',
]);

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif']);

const DOCUMENT_EXTS = new Set([
  'md', 'mdx', 'txt', 'pdf', 'doc', 'docx', 'rtf', 'odt', 'csv', 'xls', 'xlsx', 'ppt', 'pptx', 'json', 'yaml', 'yml',
]);

export function flattenWorkspace(nodes: FileNode[]): FileNode[] {
  const result: FileNode[] = [];
  const walk = (list: FileNode[]) => {
    for (const node of list) {
      result.push(node);
      if (node.children?.length) walk(node.children);
    }
  };
  walk(nodes);
  return result;
}

export function matchesFilter(node: FileNode, filter: SearchFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'folder') return node.isDirectory;
  if (filter === 'file') return !node.isDirectory;
  if (node.isDirectory) return false;
  const ext = node.name.split('.').pop()?.toLowerCase() || '';
  if (filter === 'code') return CODE_EXTS.has(ext);
  if (filter === 'image') return IMAGE_EXTS.has(ext);
  if (filter === 'document') return DOCUMENT_EXTS.has(ext);
  return true;
}

export function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  let score = 0;
  let consecutive = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++;
      consecutive++;
      score += consecutive * 2;
    } else {
      consecutive = 0;
    }
  }
  return qi === q.length ? score : -1;
}

export function wildcardToRegex(pattern: string): RegExp | null {
  if (!pattern.includes('*') && !pattern.includes('?')) return null;
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  try {
    return new RegExp(escaped, 'i');
  } catch {
    return null;
  }
}

export function scoreNode(query: string, node: FileNode): number {
  const trimmed = query.trim();
  if (!trimmed) return 0;

  const wildcard = wildcardToRegex(trimmed);
  if (wildcard) {
    const nameMatch = wildcard.test(node.name);
    const pathMatch = wildcard.test(node.path);
    if (!nameMatch && !pathMatch) return -1;
    return nameMatch ? 200 : 150;
  }

  const nameScore = fuzzyScore(trimmed, node.name);
  const pathTail = node.path.split(/[\\/]/).pop() || node.path;
  const pathScore = fuzzyScore(trimmed, pathTail);
  const fullPathScore = fuzzyScore(trimmed, node.path.replace(/\\/g, '/')) * 0.6;
  return Math.max(nameScore, pathScore, fullPathScore);
}

export function searchWorkspace(
  nodes: FileNode[],
  query: string,
  filter: SearchFilter,
  limit = 50,
): Array<{ node: FileNode; score: number }> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  return flattenWorkspace(nodes)
    .filter(node => matchesFilter(node, filter))
    .map(node => ({ node, score: scoreNode(trimmed, node) }))
    .filter(item => item.score >= 0)
    .sort((a, b) => b.score - a.score || a.node.name.localeCompare(b.node.name))
    .slice(0, limit);
}

export function relativeWorkspacePath(fullPath: string, workspace: string | null): string {
  if (!workspace) return fullPath;
  const norm = (value: string) => value.replace(/\\/g, '/');
  const base = norm(workspace).replace(/\/$/, '');
  const target = norm(fullPath);
  if (target === base) return '.';
  const prefix = `${base}/`;
  if (target.startsWith(prefix)) return target.slice(prefix.length);
  return fullPath;
}

export const RECENT_SEARCHES_KEY = 'quickOpenRecentSearches';
export const MAX_RECENT_SEARCHES = 12;

export async function loadRecentSearches(): Promise<string[]> {
  try {
    const raw = await window.api.settings.get(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export async function saveRecentSearches(items: string[]): Promise<void> {
  await window.api.settings.set(RECENT_SEARCHES_KEY, JSON.stringify(items.slice(0, MAX_RECENT_SEARCHES)));
}

export async function pushRecentSearch(term: string): Promise<string[]> {
  const trimmed = term.trim();
  if (!trimmed) return loadRecentSearches();
  const current = await loadRecentSearches();
  const next = [trimmed, ...current.filter(item => item !== trimmed)].slice(0, MAX_RECENT_SEARCHES);
  await saveRecentSearches(next);
  return next;
}

export interface ContentSearchMatch {
  path: string;
  name: string;
  line: number;
  preview: string;
  score: number;
}

export type QuickOpenResultItem =
  | { type: 'file'; node: FileNode; score: number }
  | { type: 'content'; match: ContentSearchMatch; score: number };

export function shouldSearchContent(filter: SearchFilter, query: string): boolean {
  const trimmed = query.trim();
  if (trimmed.length < 2) return false;
  return filter === 'all' || filter === 'code' || filter === 'document';
}

export function getContentSearchFilter(filter: SearchFilter): 'all' | 'code' | 'document' {
  if (filter === 'code') return 'code';
  if (filter === 'document') return 'document';
  return 'all';
}

export function mergeQuickOpenResults(
  pathResults: Array<{ node: FileNode; score: number }>,
  contentResults: ContentSearchMatch[],
  limit = 50,
): QuickOpenResultItem[] {
  const contentPaths = new Set(contentResults.map(item => item.path));
  const merged: QuickOpenResultItem[] = [
    ...contentResults.map(match => ({ type: 'content' as const, match, score: match.score + 10 })),
    ...pathResults
      .filter(item => !contentPaths.has(item.node.path))
      .map(item => ({ type: 'file' as const, node: item.node, score: item.score })),
  ];

  return merged
    .sort((a, b) => b.score - a.score || getResultLabel(a).localeCompare(getResultLabel(b)))
    .slice(0, limit);
}

export function getResultLabel(item: QuickOpenResultItem): string {
  if (item.type === 'file') return item.node.path;
  return `${item.match.path}:${item.match.line}`;
}
