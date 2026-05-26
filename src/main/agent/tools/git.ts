import {
  commitGit,
  getGitDiff,
  getGitLog,
  getGitStatus,
  stageGitPaths,
  unstageGitPaths,
} from '../../services/git';
import type { ToolDef } from './index';

function formatStatus(cwd: string) {
  return getGitStatus(cwd).then(status => {
    if (!status.isRepo) return '当前目录不是 Git 仓库';
    const lines = [
      `分支: ${status.branch}${status.upstream ? ` (跟踪 ${status.upstream})` : ''}`,
      status.ahead ? `领先 ${status.ahead} 个提交` : '',
      status.behind ? `落后 ${status.behind} 个提交` : '',
      status.clean ? '工作区干净' : '',
      status.staged.length ? `\n已暂存 (${status.staged.length}):\n${status.staged.map(f => `  ${f.status} ${f.path}`).join('\n')}` : '',
      status.unstaged.length ? `\n未暂存变更 (${status.unstaged.length}):\n${status.unstaged.map(f => `  ${f.status} ${f.path}`).join('\n')}` : '',
      status.untracked.length ? `\n未跟踪 (${status.untracked.length}):\n${status.untracked.map(f => `  ? ${f.path}`).join('\n')}` : '',
    ].filter(Boolean);
    return lines.join('\n');
  });
}

export function createGitStatusTool(projectDir: string): ToolDef {
  return {
    name: 'git_status',
    description: '查看 Git 仓库状态（分支、暂存/未暂存/未跟踪文件）',
    parameters: { type: 'object', properties: {} },
    execute: async () => formatStatus(projectDir),
  };
}

export function createGitDiffTool(projectDir: string): ToolDef {
  return {
    name: 'git_diff',
    description: '查看 Git diff，可选指定文件与是否查看已暂存差异',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '相对项目根目录的文件路径' },
        staged: { type: 'boolean', description: '是否查看已暂存差异' },
      },
    },
    execute: async (args) => {
      const diff = await getGitDiff(projectDir, args.path as string | undefined, !!args.staged);
      return diff.length > 12000 ? diff.slice(0, 12000) + '\n...[已截断]' : diff;
    },
  };
}

export function createGitAddTool(projectDir: string): ToolDef {
  return {
    name: 'git_add',
    description: '将文件加入 Git 暂存区',
    parameters: {
      type: 'object',
      properties: {
        paths: { type: 'array', items: { type: 'string' }, description: '相对项目根目录的文件路径列表' },
      },
      required: ['paths'],
    },
    execute: async (args) => {
      const paths = args.paths as string[];
      if (!Array.isArray(paths) || paths.length === 0) throw new Error('paths 不能为空');
      await stageGitPaths(projectDir, paths);
      return `已暂存 ${paths.length} 个文件:\n${paths.map(p => `- ${p}`).join('\n')}`;
    },
  };
}

export function createGitCommitTool(projectDir: string): ToolDef {
  return {
    name: 'git_commit',
    description: '提交已暂存的 Git 变更',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: '提交说明' },
      },
      required: ['message'],
    },
    requiresConfirm: true,
    execute: async (args) => {
      const hash = await commitGit(projectDir, args.message as string);
      return `提交成功: ${hash}`;
    },
  };
}

export function createGitLogTool(projectDir: string): ToolDef {
  return {
    name: 'git_log',
    description: '查看最近 Git 提交记录',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: '返回条数，默认 10，最大 50' },
      },
    },
    execute: async (args) => {
      const entries = await getGitLog(projectDir, typeof args.limit === 'number' ? args.limit : 10);
      if (entries.length === 0) return '(暂无提交记录)';
      return entries.map(e => `${e.hash} ${e.message}`).join('\n');
    },
  };
}
