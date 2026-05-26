import path from 'path';

export interface ExploreState {
  readCallCount: number;
  uniqueReadCount: number;
  totalFiles: number;
  readFiles: Set<string>;
  readPercentage: number;
  unreadFiles: string[];
  totalToolCalls: number;
  listCount: number;
}

const PRODUCTIVE_TOOLS = new Set([
  'edit_file', 'write_file', 'bash', 'grep', 'glob',
  'generate_image', 'spawn_sub_agent', 'auto_decompose_task',
]);

function normalizeProjectPath(projectDir: string, filePath: string): string {
  const relative = path.isAbsolute(filePath)
    ? path.relative(projectDir, filePath)
    : filePath;
  return relative.replace(/\\/g, '/');
}

function isFileMarkedRead(readFiles: Set<string>, relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/');
  return readFiles.has(normalized);
}

export function buildExploreState(
  messages: Array<{ role: string; content: string; tool_calls?: Array<{ function?: { name: string; arguments: string } }> }>,
  projectDir: string
): ExploreState {
  let readCallCount = 0;
  let listCount = 0;
  let totalToolCalls = 0;
  const readFiles = new Set<string>();

  for (const m of messages) {
    if (m.role === 'assistant' && m.tool_calls) {
      for (const tc of m.tool_calls) {
        totalToolCalls++;
        if (tc.function?.name === 'read_file') {
          readCallCount++;
          try {
            const args = JSON.parse(tc.function?.arguments || '{}');
            if (args.path) readFiles.add(normalizeProjectPath(projectDir, args.path));
          } catch {}
        }
        if (tc.function?.name === 'list_files') {
          listCount++;
        }
      }
    }
  }

  const glob = require('glob');
  const allSourceFiles = glob.sync('**/*.{ts,tsx,js,jsx,json}', {
    cwd: projectDir,
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
    absolute: false,
  }) as string[];

  const totalFiles = allSourceFiles.length;
  const uniqueReadCount = allSourceFiles.filter((f) => isFileMarkedRead(readFiles, f)).length;
  const readPercentage = totalFiles > 0 ? Math.round((uniqueReadCount / totalFiles) * 100) : 0;
  const unreadFiles = allSourceFiles.filter((f) => !isFileMarkedRead(readFiles, f));

  return {
    readCallCount,
    uniqueReadCount,
    totalFiles,
    readFiles,
    readPercentage,
    unreadFiles,
    totalToolCalls,
    listCount,
  };
}

export function detectExploreMode(
  messages: Array<{ role: string; content: string; tool_calls?: Array<{ function?: { name: string; arguments: string } }> }>,
  resultContent: string
): boolean {
  let readCallCount = 0;
  let listCount = 0;
  let hasProductiveToolCall = false;

  for (const m of messages) {
    if (m.role === 'assistant' && m.tool_calls) {
      for (const tc of m.tool_calls) {
        const name = tc.function?.name;
        if (name === 'read_file') readCallCount++;
        if (name === 'list_files') listCount++;
        if (name && PRODUCTIVE_TOOLS.has(name)) hasProductiveToolCall = true;
      }
    }
  }

  const hasSubstantialOutput = resultContent.length > 200;
  return (readCallCount > 0 || listCount > 0) && !hasSubstantialOutput && !hasProductiveToolCall;
}

export function shouldContinueExplore(state: ExploreState): boolean {
  return state.readPercentage < 80 && state.unreadFiles.length > 0;
}

export function buildExploreNudge(state: ExploreState, turn: number, maxTurns: number): string {
  const { uniqueReadCount, totalFiles, readPercentage, unreadFiles } = state;

  const unreadByDir: Record<string, string[]> = {};
  for (const f of unreadFiles) {
    const dir = path.dirname(f);
    if (!unreadByDir[dir]) unreadByDir[dir] = [];
    unreadByDir[dir].push(path.basename(f));
  }

  const criticalDirs = Object.keys(unreadByDir)
    .filter(d => d.startsWith('src/'))
    .sort((a, b) => unreadByDir[b].length - unreadByDir[a].length)
    .slice(0, 3);

  let msg = `**进度检查**：你已读取 ${uniqueReadCount}/${totalFiles} 个文件（${readPercentage}%），还有 ${unreadFiles.length} 个文件未读。当前轮次：${turn + 1}/${maxTurns}\n\n`;

  if (criticalDirs.length > 0) {
    msg += `**未读的关键目录**：\n`;
    for (const dir of criticalDirs) {
      const files = unreadByDir[dir].slice(0, 5);
      msg += `- ${dir}/: ${files.join(', ')}${unreadByDir[dir].length > 5 ? ` 等 ${unreadByDir[dir].length} 个文件` : ''}\n`;
    }
    msg += `\n请继续读取这些目录下的文件。每个回合批量读取 3-5 个文件，直到覆盖所有核心源码。`;
  } else {
    const sampleUnread = unreadFiles.slice(0, 10);
    msg += `**部分未读文件**：\n${sampleUnread.map(f => `- ${f}`).join('\n')}\n\n请继续读取这些文件。`;
  }

  return msg;
}

export function buildExploreCompletionNudge(state: ExploreState): string {
  return `你已读取了 ${state.readPercentage}% 的文件（${state.uniqueReadCount}/${state.totalFiles}），但没有给出分析。请基于你读取的内容，给出完整的项目分析：\n1. 项目架构和技术栈\n2. 各模块功能说明\n3. 发现的问题或建议\n4. 代码质量评估`;
}
