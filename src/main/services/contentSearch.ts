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

const CODE_EXTS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'hpp',
  'cs', 'php', 'rb', 'swift', 'kt', 'dart', 'lua', 'sh', 'bash', 'zsh', 'ps1', 'sql', 'vue', 'svelte',
]);

const DOCUMENT_EXTS = new Set([
  'md', 'mdx', 'txt', 'json', 'yaml', 'yml', 'csv', 'toml', 'ini', 'env',
]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.turbo', 'out',
]);

const MAX_FILE_SIZE = 512 * 1024;
const MAX_FILES_SCANNED = 1000;
const MAX_RESULTS = 40;
const MAX_MATCHES_PER_FILE = 2;

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

function matchesContentQuery(query: string, line: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;
  const wildcard = wildcardToRegex(trimmed);
  if (wildcard) return wildcard.test(line);
  return line.toLowerCase().includes(trimmed.toLowerCase());
}

function scoreContentLine(query: string, line: string): number {
  const trimmed = query.trim();
  const wildcard = wildcardToRegex(trimmed);
  if (wildcard) return 90;

  const lowerLine = line.toLowerCase();
  const lowerQuery = trimmed.toLowerCase();
  if (new RegExp(`\\b${escapeRegex(lowerQuery)}\\b`, 'i').test(line)) return 130;
  const index = lowerLine.indexOf(lowerQuery);
  if (index >= 0) return 100 - Math.min(index, 40);
  return 80;
}

function shouldSearchFile(name: string, filter: ContentSearchFilter): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (filter === 'code') return CODE_EXTS.has(ext);
  if (filter === 'document') return DOCUMENT_EXTS.has(ext);
  return CODE_EXTS.has(ext) || DOCUMENT_EXTS.has(ext);
}

function trimPreview(line: string, max = 120): string {
  const compact = line.trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1)}…`;
}

function scanFile(
  filePath: string,
  query: string,
  results: ContentSearchMatch[],
): void {
  if (results.length >= MAX_RESULTS) return;

  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return;
  }
  if (!stat.isFile() || stat.size > MAX_FILE_SIZE) return;

  try {
    checkSensitiveFile(filePath, 'read');
  } catch {
    return;
  }

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return;
  }
  if (content.includes('\0')) return;

  const name = path.basename(filePath);
  let fileMatches = 0;
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (results.length >= MAX_RESULTS || fileMatches >= MAX_MATCHES_PER_FILE) break;
    const line = lines[i];
    if (!matchesContentQuery(query, line)) continue;
    results.push({
      path: filePath,
      name,
      line: i + 1,
      preview: trimPreview(line),
      score: scoreContentLine(query, line),
    });
    fileMatches++;
  }
}

function scanDirectory(
  dirPath: string,
  query: string,
  filter: ContentSearchFilter,
  results: ContentSearchMatch[],
  state: { scannedFiles: number },
  depth = 0,
): void {
  if (depth > 12 || results.length >= MAX_RESULTS || state.scannedFiles >= MAX_FILES_SCANNED) return;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (results.length >= MAX_RESULTS || state.scannedFiles >= MAX_FILES_SCANNED) break;
    if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;

    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      scanDirectory(fullPath, query, filter, results, state, depth + 1);
      continue;
    }

    if (!entry.isFile() || !shouldSearchFile(entry.name, filter)) continue;
    state.scannedFiles++;
    scanFile(fullPath, query, results);
  }
}

export function searchWorkspaceContent(
  workspace: string,
  query: string,
  filter: ContentSearchFilter,
): ContentSearchMatch[] {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];
  if (!fs.existsSync(workspace)) return [];

  const results: ContentSearchMatch[] = [];
  scanDirectory(workspace, trimmed, filter, results, { scannedFiles: 0 });
  return results.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path) || a.line - b.line);
}

export { matchesContentQuery, wildcardToRegex };
