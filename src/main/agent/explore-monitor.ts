import path from 'path';

interface ExploreState {
  readFileCount: number;
  totalFiles: number;
  readFiles: Set<string>;
  readPercentage: number;
  unreadFiles: string[];
  totalToolCalls: number;
}

export function buildExploreState(
  messages: Array<{ role: string; content: string; tool_calls?: Array<{ function?: { name: string; arguments: string } }> }>,
  projectDir: string
): ExploreState {
  let readFileCount = 0;
  let totalToolCalls = 0;
  const readFiles = new Set<string>();

  for (const m of messages) {
    if (m.role === 'assistant' && m.tool_calls) {
      for (const tc of m.tool_calls) {
        totalToolCalls++;
        if (tc.function?.name === 'read_file') {
          readFileCount++;
          try {
            const args = JSON.parse(tc.function?.arguments || '{}');
            if (args.path) readFiles.add(args.path);
          } catch {}
        }
      }
    }
  }

  // 扫描所有源文件
  const glob = require('glob');
  const allSourceFiles = glob.sync('**/*.{ts,tsx,js,jsx,json}', {
    cwd: projectDir,
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
    absolute: false,
  }) as string[];

  const totalFiles = allSourceFiles.length;
  const readPercentage = totalFiles > 0 ? Math.round((readFileCount / totalFiles) * 100) : 0;
  const unreadFiles = allSourceFiles.filter(
    f => !readFiles.has(f) && !readFiles.has(path.join(projectDir, f))
  );

  return { readFileCount, totalFiles, readFiles, readPercentage, unreadFiles, totalToolCalls };
}

export function shouldContinueExplore(state: ExploreState): boolean {
  return state.readPercentage < 80 && state.unreadFiles.length > 0;
}

export function buildExploreNudge(state: ExploreState, turn: number, maxTurns: number): string {
  const { readFileCount, totalFiles, readPercentage, unreadFiles } = state;

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

  let msg = `**进度检查**：你已读取 ${readFileCount}/${totalFiles} 个文件（${readPercentage}%），还有 ${unreadFiles.length} 个文件未读。当前轮次：${turn + 1}/${maxTurns}\n\n`;

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
  return `你已读取了 ${state.readPercentage}% 的文件（${state.readFileCount}/${state.totalFiles}），但没有给出分析。请基于你读取的内容，给出完整的项目分析：\n1. 项目架构和技术栈\n2. 各模块功能说明\n3. 发现的问题或建议\n4. 代码质量评估`;
}
