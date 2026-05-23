import fs from 'fs';
import path from 'path';
import { safeResolve } from './security';
import type { ToolDef } from './index';

export function createWriteFileTool(projectDir: string): ToolDef {
  return {
    name: 'write_file',
    description: '写入/创建文件',
    parameters: {
      type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'],
    },
    requiresConfirm: true,
    execute: async (args) => {
      const filePath = safeResolve(projectDir, args.path as string);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, args.content as string, 'utf-8');
      return 'OK';
    },
  };
}
