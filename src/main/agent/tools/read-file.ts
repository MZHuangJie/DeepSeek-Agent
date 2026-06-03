// 读取文件内容 — read_file 工具
// 参数: path(路径), offset(起始行), limit(行数)
// 安全: 拒绝读取敏感文件(.env, .pem, id_rsa等)
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
      const filePath = safeResolve(projectDir, args.path as string);
      checkSensitiveFile(filePath);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const start = ((args.offset as number) ?? 1) - 1;
      const end = args.limit ? start + (args.limit as number) : lines.length;
      return lines.slice(start, end).map((l, i) => `${start + i + 1}: ${l}`).join('\n');
    },
  };
}
