// 文件匹配 — glob 工具
// 参数: pattern(glob模式如 **/*.ts)
import type { ToolDef } from './index';

const GLOB_MAX_RESULTS = 500;

export function createGlobTool(projectDir: string): ToolDef {
  return {
    name: 'glob', description: '文件模式匹配',
    parameters: { type: 'object', properties: { pattern: { type: 'string' } }, required: ['pattern'] },
    execute: async (args) => {
      const { glob } = await import('glob');
      const matches = await glob(args.pattern as string, {
        cwd: projectDir,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
      });
      if (matches.length > GLOB_MAX_RESULTS) {
        const truncated = matches.slice(0, GLOB_MAX_RESULTS);
        return truncated.join('\n') + `\n\n[已截断：共 ${matches.length} 个匹配，仅返回前 ${GLOB_MAX_RESULTS} 个]`;
      }
      return matches.join('\n');
    },
  };
}
