// 列出目录内容 — list_files 工具
// 参数: path(目录路径，默认项目根)
import fs from 'fs';
import { safeResolve } from './security';
import type { ToolDef } from './index';

export function createListFilesTool(projectDir: string): ToolDef {
  return {
    name: 'list_files',
    description: '列出目录内容',
    parameters: { type: 'object', properties: { path: { type: 'string' } } },
    execute: async (args) => {
      const dirPath = args.path ? safeResolve(projectDir, args.path as string) : projectDir;
      return fs.readdirSync(dirPath, { withFileTypes: true }).map(e => `${e.isDirectory() ? 'd' : 'f'} ${e.name}`).join('\n');
    },
  };
}
