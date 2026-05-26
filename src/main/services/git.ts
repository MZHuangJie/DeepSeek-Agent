import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { getChildProcessEnv } from '../utils/shellEnv';
import { buildAskpassEnv, applyGitIdentityEnv, ensureSshKeysUnlocked } from '../utils/gitAskpass';

const execFileAsync = promisify(execFile);

export interface GitFileEntry {
  path: string;
  status: string;
}

export interface GitBranchInfo {
  name: string;
  current: boolean;
  remote: boolean;
}

export interface GitStashEntry {
  index: number;
  message: string;
}

export interface GitStatusResult {
  isRepo: boolean;
  branch: string;
  upstream?: string;
  hasUpstream: boolean;
  detached: boolean;
  ahead: number;
  behind: number;
  staged: GitFileEntry[];
  unstaged: GitFileEntry[];
  untracked: GitFileEntry[];
  conflicts: GitFileEntry[];
  clean: boolean;
}

export interface GitLogEntry {
  hash: string;
  message: string;
}

export interface GitSyncResult {
  pull: string;
  push: string;
}

export class GitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitError';
  }
}

const UNMERGED = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU']);

async function runGit(
  cwd: string,
  args: string[],
  options?: { maxBuffer?: number; needsAuth?: boolean },
): Promise<string> {
  const maxBuffer = options?.maxBuffer ?? 4 * 1024 * 1024;
  try {
    if (options?.needsAuth) {
      await ensureSshKeysUnlocked(cwd);
    }
    let env = options?.needsAuth
      ? applyGitIdentityEnv(await buildAskpassEnv())
      : getChildProcessEnv();
    const { stdout } = await execFileAsync('git', args, {
      cwd,
      maxBuffer,
      encoding: 'utf-8',
      windowsHide: true,
      env,
    });
    return stdout ?? '';
  } catch (err: unknown) {
    const e = err as { stderr?: string; stdout?: string; message?: string; code?: number };
    const detail = (e.stderr || e.stdout || e.message || 'Git 命令执行失败').trim();
    const firstLine = detail.split('\n').filter(Boolean)[0]?.slice(0, 400) || 'Git 命令执行失败';
    if (/Permission denied \(publickey\)/i.test(firstLine)) {
      throw new GitError('SSH 公钥认证失败。请在弹窗中输入密钥 passphrase，或先在终端执行 ssh-add 加载密钥。');
    }
    throw new GitError(firstLine);
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

function decodePorcelainPath(raw: string): string {
  let filePath = raw.trim();
  if (filePath.startsWith('"') && filePath.endsWith('"')) {
    filePath = filePath.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  if (filePath.includes(' -> ')) filePath = filePath.split(' -> ')[1];
  return filePath;
}

export function parsePorcelainStatus(output: string): Omit<GitStatusResult, 'isRepo'> {
  const lines = output.split('\n').filter(Boolean);
  let branch = 'HEAD';
  let upstream: string | undefined;
  let hasUpstream = false;
  let detached = false;
  let ahead = 0;
  let behind = 0;
  const staged: GitFileEntry[] = [];
  const unstaged: GitFileEntry[] = [];
  const untracked: GitFileEntry[] = [];
  const conflicts: GitFileEntry[] = [];

  for (const line of lines) {
    if (line.startsWith('##')) {
      if (line.includes('(no branch)')) {
        detached = true;
        const m = line.match(/\(HEAD detached at ([^)]+)\)/);
        branch = m ? `HEAD detached at ${m[1]}` : 'HEAD (detached)';
      } else {
        const match = line.match(/^## ([^\s.]+)(?:\.\.\.([^\s\[]+))?(?: \[([^\]]*)\])?/);
        if (match) {
          branch = match[1];
          upstream = match[2];
          hasUpstream = !!upstream;
          const flags = match[3] || '';
          const aheadM = flags.match(/ahead (\d+)/);
          const behindM = flags.match(/behind (\d+)/);
          ahead = aheadM ? parseInt(aheadM[1], 10) : 0;
          behind = behindM ? parseInt(behindM[1], 10) : 0;
        }
      }
      continue;
    }
    if (line.length < 3) continue;

    const x = line[0];
    const y = line[1];
    const filePath = decodePorcelainPath(line.slice(3));
    const pair = `${x}${y}`;

    if (UNMERGED.has(pair)) {
      conflicts.push({ path: filePath, status: pair });
      continue;
    }

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

  const clean = staged.length === 0 && unstaged.length === 0 && untracked.length === 0 && conflicts.length === 0;
  return { branch, upstream, hasUpstream, detached, ahead, behind, staged, unstaged, untracked, conflicts, clean };
}

export async function getGitStatus(cwd: string): Promise<GitStatusResult> {
  const repo = await isGitRepo(cwd);
  if (!repo) {
    return {
      isRepo: false,
      branch: '',
      hasUpstream: false,
      detached: false,
      ahead: 0,
      behind: 0,
      staged: [],
      unstaged: [],
      untracked: [],
      conflicts: [],
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

export async function initGitRepo(cwd: string): Promise<void> {
  await runGit(cwd, ['init']);
}

export async function listGitBranches(cwd: string): Promise<GitBranchInfo[]> {
  const current = (await runGit(cwd, ['branch', '--show-current'])).trim();
  const localOut = await runGit(cwd, ['branch', '--format=%(refname:short)']);
  const local = localOut.split('\n').filter(Boolean).map(name => ({
    name: name.trim(),
    current: name.trim() === current,
    remote: false,
  }));

  let remote: GitBranchInfo[] = [];
  try {
    const remoteOut = await runGit(cwd, ['branch', '-r', '--format=%(refname:short)']);
    remote = remoteOut.split('\n').filter(Boolean)
      .map(n => n.trim())
      .filter(n => !n.includes('HEAD ->'))
      .map(name => ({ name, current: false, remote: true }));
  } catch {
    remote = [];
  }

  return [...local, ...remote];
}

export async function checkoutGitBranch(cwd: string, branch: string, create = false): Promise<void> {
  const name = branch.trim();
  if (!name) throw new GitError('分支名不能为空');
  if (create) {
    await runGit(cwd, ['checkout', '-b', name]);
    return;
  }
  if (name.startsWith('origin/')) {
    const localName = name.replace(/^origin\//, '');
    try {
      await runGit(cwd, ['checkout', localName]);
    } catch {
      await runGit(cwd, ['checkout', '-b', localName, name]);
    }
    return;
  }
  await runGit(cwd, ['checkout', name]);
}

export async function getGitDiff(cwd: string, filePath?: string, staged = false): Promise<string> {
  if (filePath) {
    const rel = normalizeRepoPath(cwd, filePath);
    const args = staged ? ['diff', '--cached', '--', rel] : ['diff', '--', rel];
    const out = await runGit(cwd, args);
    if (out.trim()) return out.trim();
    if (!staged) {
      const fs = await import('fs');
      const abs = path.resolve(cwd, rel);
      if (fs.existsSync(abs)) {
        const content = fs.readFileSync(abs, 'utf-8');
        const preview = content.split('\n').slice(0, 300).map(l => `+${l}`).join('\n');
        return `(新文件 ${rel})\n${preview}${content.split('\n').length > 300 ? '\n...[已截断]' : ''}`;
      }
    }
    return '(无差异)';
  }
  const args = staged ? ['diff', '--cached'] : ['diff'];
  const out = await runGit(cwd, args);
  return out.trim() || '(无差异)';
}

export async function stageGitPaths(cwd: string, paths: string[]): Promise<void> {
  if (paths.length === 0) throw new GitError('未指定要暂存的文件');
  const rel = paths.map(p => normalizeRepoPath(cwd, p));
  await runGit(cwd, ['add', '--', ...rel]);
}

export async function stageAllGit(cwd: string): Promise<void> {
  await runGit(cwd, ['add', '-A']);
}

export async function unstageGitPaths(cwd: string, paths: string[]): Promise<void> {
  if (paths.length === 0) throw new GitError('未指定要取消暂存的文件');
  const rel = paths.map(p => normalizeRepoPath(cwd, p));
  await runGit(cwd, ['restore', '--staged', '--', ...rel]);
}

export async function unstageAllGit(cwd: string): Promise<void> {
  await runGit(cwd, ['restore', '--staged', '.']);
}

export async function discardGitPaths(cwd: string, paths: string[]): Promise<void> {
  if (paths.length === 0) throw new GitError('未指定要还原的文件');
  const rel = paths.map(p => normalizeRepoPath(cwd, p));
  await runGit(cwd, ['restore', '--', ...rel]);
}

export async function discardAllGit(cwd: string): Promise<void> {
  await runGit(cwd, ['restore', '.']);
}

export async function cleanUntrackedGit(cwd: string): Promise<string> {
  const preview = await runGit(cwd, ['clean', '-fdn']);
  if (!preview.trim()) return '(无未跟踪文件可清理)';
  await runGit(cwd, ['clean', '-fd']);
  return preview.trim();
}

export async function commitGit(cwd: string, message: string): Promise<string> {
  const trimmed = message.trim();
  if (!trimmed) throw new GitError('提交信息不能为空');
  if (trimmed.length > 5000) throw new GitError('提交信息过长');
  await runGit(cwd, ['commit', '-m', trimmed]);
  return (await runGit(cwd, ['rev-parse', '--short', 'HEAD'])).trim();
}

export async function fetchGit(cwd: string): Promise<string> {
  const out = await runGit(cwd, ['fetch', '--all', '--prune'], { needsAuth: true });
  return out.trim() || '已 fetch 远程更新';
}

export async function pullGit(cwd: string): Promise<string> {
  const out = await runGit(cwd, ['pull', '--no-rebase'], { needsAuth: true });
  return out.trim() || '已 pull 最新代码';
}

export async function pullRebaseGit(cwd: string): Promise<string> {
  const out = await runGit(cwd, ['pull', '--rebase'], { needsAuth: true });
  return out.trim() || '已 rebase pull';
}

export async function pushGit(cwd: string): Promise<string> {
  const out = await runGit(cwd, ['push'], { needsAuth: true });
  return out.trim() || '已 push 到远程';
}

export async function publishGitBranch(cwd: string): Promise<string> {
  const branch = (await runGit(cwd, ['branch', '--show-current'])).trim();
  if (!branch) throw new GitError('当前不在分支上，无法发布');
  const out = await runGit(cwd, ['push', '-u', 'origin', branch], { needsAuth: true });
  return out.trim() || `已发布分支 ${branch}`;
}

export async function syncGit(cwd: string): Promise<GitSyncResult> {
  const pull = await pullGit(cwd);
  const push = await pushGit(cwd);
  return { pull, push };
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

export async function stashPushGit(cwd: string, message?: string): Promise<string> {
  const args = ['stash', 'push', '-u', '-m', message?.trim() || 'WIP'];
  const out = await runGit(cwd, args);
  return out.trim() || '已 stash 当前更改';
}

export async function stashPopGit(cwd: string): Promise<string> {
  const out = await runGit(cwd, ['stash', 'pop']);
  return out.trim() || '已 pop stash';
}

export async function listGitStashes(cwd: string): Promise<GitStashEntry[]> {
  const out = await runGit(cwd, ['stash', 'list']);
  if (!out.trim()) return [];
  return out.split('\n').filter(Boolean).map((line, index) => ({
    index,
    message: line.replace(/^stash@\{\d+\}:\s*/, ''),
  }));
}
