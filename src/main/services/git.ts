import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);

export interface GitFileEntry {
  path: string;
  status: string;
}

export interface GitStatusResult {
  isRepo: boolean;
  branch: string;
  upstream?: string;
  ahead: number;
  behind: number;
  staged: GitFileEntry[];
  unstaged: GitFileEntry[];
  untracked: GitFileEntry[];
  clean: boolean;
}

export interface GitLogEntry {
  hash: string;
  message: string;
}

export class GitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitError';
  }
}

async function runGit(cwd: string, args: string[], maxBuffer = 4 * 1024 * 1024): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd,
      maxBuffer,
      encoding: 'utf-8',
      windowsHide: true,
    });
    return stdout ?? '';
  } catch (err: unknown) {
    const e = err as { stderr?: string; stdout?: string; message?: string; code?: number };
    const detail = (e.stderr || e.stdout || e.message || 'Git 命令执行失败').trim();
    throw new GitError(detail.split('\n')[0].slice(0, 400));
  }
}

export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    const out = await runGit(cwd, ['rev-parse', '--is-inside-work-tree']);
    return out.trim() === 'true';
  } catch {
    return false;
  }
}

export function parsePorcelainStatus(output: string): Omit<GitStatusResult, 'isRepo'> {
  const lines = output.split('\n').filter(Boolean);
  let branch = 'HEAD';
  let upstream: string | undefined;
  let ahead = 0;
  let behind = 0;
  const staged: GitFileEntry[] = [];
  const unstaged: GitFileEntry[] = [];
  const untracked: GitFileEntry[] = [];

  for (const line of lines) {
    if (line.startsWith('##')) {
      const match = line.match(/^## ([^\s.]+)(?:\.\.\.([^\s\[]+))?(?: \[([^\]]*)\])?/);
      if (match) {
        branch = match[1];
        upstream = match[2];
        const flags = match[3] || '';
        const aheadM = flags.match(/ahead (\d+)/);
        const behindM = flags.match(/behind (\d+)/);
        ahead = aheadM ? parseInt(aheadM[1], 10) : 0;
        behind = behindM ? parseInt(behindM[1], 10) : 0;
      }
      continue;
    }
    if (line.length < 3) continue;

    const x = line[0];
    const y = line[1];
    let filePath = line.slice(3).trim();
    if (filePath.startsWith('"') && filePath.endsWith('"')) {
      filePath = filePath.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
    if (filePath.includes(' -> ')) filePath = filePath.split(' -> ')[1];

    if (x === '?' && y === '?') {
      untracked.push({ path: filePath, status: '?' });
      continue;
    }
    if (x !== ' ' && x !== '?') {
      staged.push({ path: filePath, status: x });
    }
    if (y !== ' ' && y !== '?') {
      unstaged.push({ path: filePath, status: y });
    }
  }

  const clean = staged.length === 0 && unstaged.length === 0 && untracked.length === 0;
  return { branch, upstream, ahead, behind, staged, unstaged, untracked, clean };
}

export async function getGitStatus(cwd: string): Promise<GitStatusResult> {
  const repo = await isGitRepo(cwd);
  if (!repo) {
    return {
      isRepo: false,
      branch: '',
      ahead: 0,
      behind: 0,
      staged: [],
      unstaged: [],
      untracked: [],
      clean: true,
    };
  }

  const output = await runGit(cwd, ['status', '--porcelain=v1', '-b']);
  return { isRepo: true, ...parsePorcelainStatus(output) };
}

function normalizeRepoPath(cwd: string, filePath: string): string {
  const resolved = path.resolve(cwd, filePath);
  const base = path.resolve(cwd);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new GitError(`路径不在仓库内: ${filePath}`);
  }
  return path.relative(cwd, resolved) || '.';
}

export async function getGitDiff(cwd: string, filePath?: string, staged = false): Promise<string> {
  const args = staged ? ['diff', '--cached'] : ['diff'];
  if (filePath) args.push('--', normalizeRepoPath(cwd, filePath));
  const out = await runGit(cwd, args);
  return out.trim() || '(无差异)';
}

export async function stageGitPaths(cwd: string, paths: string[]): Promise<void> {
  if (paths.length === 0) throw new GitError('未指定要暂存的文件');
  const rel = paths.map(p => normalizeRepoPath(cwd, p));
  await runGit(cwd, ['add', '--', ...rel]);
}

export async function unstageGitPaths(cwd: string, paths: string[]): Promise<void> {
  if (paths.length === 0) throw new GitError('未指定要取消暂存的文件');
  const rel = paths.map(p => normalizeRepoPath(cwd, p));
  await runGit(cwd, ['restore', '--staged', '--', ...rel]);
}

export async function discardGitPaths(cwd: string, paths: string[]): Promise<void> {
  if (paths.length === 0) throw new GitError('未指定要还原的文件');
  const rel = paths.map(p => normalizeRepoPath(cwd, p));
  await runGit(cwd, ['restore', '--', ...rel]);
}

export async function commitGit(cwd: string, message: string): Promise<string> {
  const trimmed = message.trim();
  if (!trimmed) throw new GitError('提交信息不能为空');
  if (trimmed.length > 5000) throw new GitError('提交信息过长');
  await runGit(cwd, ['commit', '-m', trimmed]);
  const hash = (await runGit(cwd, ['rev-parse', '--short', 'HEAD'])).trim();
  return hash;
}

export async function getGitLog(cwd: string, limit = 20): Promise<GitLogEntry[]> {
  const n = Math.min(Math.max(limit, 1), 50);
  const out = await runGit(cwd, ['log', `-n${n}`, '--pretty=format:%h|%s']);
  if (!out.trim()) return [];
  return out.split('\n').filter(Boolean).map(line => {
    const sep = line.indexOf('|');
    if (sep < 0) return { hash: line, message: '' };
    return { hash: line.slice(0, sep), message: line.slice(sep + 1) };
  });
}
