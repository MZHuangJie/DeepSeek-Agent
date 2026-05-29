// 计划文档写入 — write_plan 工具（Plan 模式专用）
// 参数: filename(文件名，无需扩展名), content(markdown 内容)
// 安全: 强制写入 projectDir/docs/plans/ 下的 .md 文件，路径防越界
import fs from 'fs';
import path from 'path';
import { safeResolve } from './security';
import type { ToolDef } from './index';

const PLAN_DIR = 'docs/plans';

function normalizePlanFilename(raw: string): string {
  // 仅保留基础文件名，剥离任何目录成分，避免越权写入
  const base = path.basename((raw || 'plan').trim());
  const withoutExt = base.replace(/\.md$/i, '');
  const safe = withoutExt.replace(/[\\/:*?"<>|]/g, '-').trim() || 'plan';
  return `${safe}.md`;
}

export function createWritePlanTool(projectDir: string): ToolDef {
  return {
    name: 'write_plan',
    description: '将实施计划写入计划文档（仅限 docs/plans/ 目录下的 .md 文件）。Plan 模式下用于输出最终方案，不能修改任何代码文件。',
    parameters: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: '计划文件名（无需扩展名，如 "重构登录流程"）' },
        content: { type: 'string', description: '计划文档的完整 Markdown 内容' },
      },
      required: ['filename', 'content'],
    },
    execute: async (args) => {
      const filename = normalizePlanFilename(args.filename as string);
      const relPath = `${PLAN_DIR}/${filename}`;
      const filePath = safeResolve(projectDir, relPath);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, args.content as string, 'utf-8');
      return `计划已写入 ${relPath}`;
    },
  };
}
