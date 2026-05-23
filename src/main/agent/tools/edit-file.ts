// 精确字符串替换编辑 — edit_file 工具
// 参数: path, old_string(原文), new_string(新文)
// 安全: 需要用户确认
import fs from 'fs';
import { safeResolve } from './security';
import type { ToolDef } from './index';

export function createEditFileTool(projectDir: string): ToolDef {
  return {
    name: 'edit_file',
    description: '精确字符串替换编辑文件',
    parameters: {
      type: 'object', properties: { path: { type: 'string' }, old_string: { type: 'string' }, new_string: { type: 'string' } }, required: ['path', 'old_string', 'new_string'],
    },
    requiresConfirm: true,
    execute: async (args) => {
      const filePath = safeResolve(projectDir, args.path as string);
      let content = fs.readFileSync(filePath, 'utf-8');
      if (!content.includes(args.old_string as string)) throw new Error('old_string 未在文件中找到');
      content = content.replace(args.old_string as string, args.new_string as string);
      fs.writeFileSync(filePath, content, 'utf-8');
      return 'OK';
    },
  };
}
