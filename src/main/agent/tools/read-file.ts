import fs from 'fs';
import { checkSensitiveFile, safeResolve } from './security';
import type { ToolDef } from './index';

export function createReadFileTool(projectDir: string): ToolDef {
  return {
    name: 'read_file',
    description: '读取文件内容',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径' },
        offset: { type: 'number', description: '开始行号' },
        limit: { type: 'number', description: '读取行数' },
      },
      required: ['path'],
    },
    execute: async (args) => {
      checkSensitiveFile(args.path as string);
      const filePath = safeResolve(projectDir, args.path as string);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const start = ((args.offset as number) ?? 1) - 1;
      const end = args.limit ? start + (args.limit as number) : lines.length;
      return lines.slice(start, end).map((l, i) => `${start + i + 1}: ${l}`).join('\n');
    },
  };
}
