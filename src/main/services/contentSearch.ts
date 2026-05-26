import fs from 'fs';
import path from 'path';
import { checkSensitiveFile } from '../agent/tools/security';

export type ContentSearchFilter = 'all' | 'code' | 'document';

export interface ContentSearchMatch {
  path: string;
  name: string;
  line: number;
  preview: string;
  score: number;
}

export interface ContentSearchProgress {
  scannedFiles: number;
  totalFiles: number;
  matchCount: number;
}

export interface ContentSearchStreamOptions {
  workspace: string;
  query: string;
  filter: ContentSearchFilter;
  filePaths?: string[];
  signal: AbortSignal;
  onBatch: (matches: ContentSearchMatch[], progress: ContentSearchProgress) => void;
}

const CODE_EXTS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'hpp',
  'cs', 'php', 'rb', 'swift', 'kt', 'dart', 'lua', 'sh', 'bash', 'zsh', 'ps1', 'sql', 'vue', 'svelte',
]);

const DOCUMENT_EXTS = new Set([
  'md', 'mdx', 'txt', 'json', 'yaml', 'yml', 'csv', 'toml', 'ini',
]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.turbo', 'out',
  'vendor', 'target', '__pycache__', '.venv', 'venv', 'bin', 'obj', 'packages',
]);

const SKIP_PATH_PARTS = [
  '/node_modules/', '/.git/', '/dist/', '/build/', '/.next/', '/coverage/',
  '/public/vs/', '/.turbo/', '/out/', '/vendor/', '/target/', '/__pycache__/',
];

const MAX_FILE_SIZE = 256 * 1024;
const MAX_FILES_SCANNED = 500;
const MAX_RESULTS = 40;
const MAX_MATCHES_PER_FILE = 2;
const YIELD_EVERY_FILES = 12;
const EMIT_EVERY_MATCHES = 6;

function wildcardToRegex(pattern: string): RegExp | null {
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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function shouldSkipPath(fullPath: string): boolean {
  const normalized = fullPath.replace(/\\/g, '/').toLowerCase();
  return SKIP_PATH_PARTS.some(part => normalized.includes(part));
}

function shouldSearchFile(name: string, filter: ContentSearchFilter): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (filter === 'code') return CODE_EXTS.has(ext);
  if (filter === 'document') return DOCUMENT_EXTS.has(ext);
  return CODE_EXTS.has(ext) || DOCUMENT_EXTS.has(ext);
}

function lineMatchesQuery(query: string, line: string, wildcard: RegExp | null, lowerQuery: string): boolean {
  if (wildcard) return wildcard.test(line);
  return line.toLowerCase().includes(lowerQuery);
}

function scoreContentLine(query: string, line: string, wildcard: RegExp | null, lowerQuery: string): number {
  if (wildcard) return 90;
  if (new RegExp(`\\b${escapeRegex(lowerQuery)}\\b`, 'i').test(line)) return 130;
  const index = line.toLowerCase().indexOf(lowerQuery);
  if (index >= 0) return 100 - Math.min(index, 40);
  return 80;
}

function trimPreview(line: string, max = 120): string {
  const compact = line.trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1)}…`;
}

function scanFile(
  filePath: string,
  query: string,
  wildcard: RegExp | null,
  lowerQuery: string,
): ContentSearchMatch[] {
  if (shouldSkipPath(filePath)) return [];

  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return [];
  }
  if (!stat.isFile() || stat.size === 0 || stat.size > MAX_FILE_SIZE) return [];

  try {
    checkSensitiveFile(filePath, 'read');
  } catch {
    return [];
  }

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }
  if (content.includes('\0')) return [];
  if (!wildcard && !content.toLowerCase().includes(lowerQuery)) return [];

  const name = path.basename(filePath);
  const matches: ContentSearchMatch[] = [];
  let lineStart = 0;
  let lineNumber = 1;

  while (lineStart <= content.length && matches.length < MAX_MATCHES_PER_FILE) {
    const lineEnd = content.indexOf('\n', lineStart);
    const line = lineEnd === -1 ? content.slice(lineStart) : content.slice(lineStart, lineEnd);
    if (lineMatchesQuery(query, line, wildcard, lowerQuery)) {
      matches.push({
        path: filePath,
        name,
        line: lineNumber,
        preview: trimPreview(line),
        score: scoreContentLine(query, line, wildcard, lowerQuery),
      });
    }
    if (lineEnd === -1) break;
    lineStart = lineEnd + 1;
    lineNumber++;
  }

  return matches;
}

function collectPathsFromWorkspace(workspace: string, filter: ContentSearchFilter): string[] {
  const paths: string[] = [];

  function walk(dirPath: string, depth: number) {
    if (depth > 10 || paths.length >= MAX_FILES_SCANNED) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (paths.length >= MAX_FILES_SCANNED) break;
      if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;

      const fullPath = path.join(dirPath, entry.name);
      if (shouldSkipPath(fullPath)) continue;

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(fullPath, depth + 1);
        continue;
      }

      if (entry.isFile() && shouldSearchFile(entry.name, filter)) {
        paths.push(fullPath);
      }
    }
  }

  if (fs.existsSync(workspace)) walk(workspace, 0);
  return paths;
}

function sortMatches(matches: ContentSearchMatch[]): ContentSearchMatch[] {
  return matches.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path) || a.line - b.line);
}

function yieldToEventLoop(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

export async function searchContentStreaming(options: ContentSearchStreamOptions): Promise<ContentSearchMatch[]> {
  const trimmed = options.query.trim();
  if (!trimmed || trimmed.length < 2 || options.signal.aborted) return [];

  const wildcard = wildcardToRegex(trimmed);
  const lowerQuery = trimmed.toLowerCase();
  const filePaths = (options.filePaths?.length
    ? options.filePaths.filter(p => !shouldSkipPath(p))
    : collectPathsFromWorkspace(options.workspace, options.filter)
  ).slice(0, MAX_FILES_SCANNED);

  const totalFiles = filePaths.length;
  const aggregated: ContentSearchMatch[] = [];
  let pendingBatch: ContentSearchMatch[] = [];
  let scannedFiles = 0;

  const flush = () => {
    if (pendingBatch.length === 0) return;
    aggregated.push(...pendingBatch);
    const sorted = sortMatches(aggregated).slice(0, MAX_RESULTS);
    aggregated.length = 0;
    aggregated.push(...sorted);
    options.onBatch([...sorted], {
      scannedFiles,
      totalFiles,
      matchCount: sorted.length,
    });
    pendingBatch = [];
  };

  for (const filePath of filePaths) {
    if (options.signal.aborted || aggregated.length >= MAX_RESULTS) break;

    const fileMatches = scanFile(filePath, trimmed, wildcard, lowerQuery);
    scannedFiles++;
    if (fileMatches.length > 0) {
      pendingBatch.push(...fileMatches);
      if (pendingBatch.length >= EMIT_EVERY_MATCHES) flush();
    }

    if (scannedFiles % YIELD_EVERY_FILES === 0) {
      flush();
      options.onBatch([...aggregated], {
        scannedFiles,
        totalFiles,
        matchCount: aggregated.length,
      });
      await yieldToEventLoop();
      if (options.signal.aborted) break;
    }
  }

  flush();
  if (!options.signal.aborted) {
    options.onBatch([...aggregated], {
      scannedFiles,
      totalFiles,
      matchCount: aggregated.length,
    });
  }

  return aggregated;
}

export async function searchWorkspaceContent(
  workspace: string,
  query: string,
  filter: ContentSearchFilter,
  filePaths?: string[],
): Promise<ContentSearchMatch[]> {
  const controller = new AbortController();
  let latest: ContentSearchMatch[] = [];
  await searchContentStreaming({
    workspace,
    query,
    filter,
    filePaths,
    signal: controller.signal,
    onBatch: (matches) => { latest = matches; },
  });
  return latest;
}

export function matchesContentQuery(query: string, line: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;
  const wildcard = wildcardToRegex(trimmed);
  return lineMatchesQuery(trimmed, line, wildcard, trimmed.toLowerCase());
}

export { wildcardToRegex };
