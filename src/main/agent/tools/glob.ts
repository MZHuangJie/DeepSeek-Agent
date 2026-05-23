import type { ToolDef } from './index';

export function createGlobTool(projectDir: string): ToolDef {
  return {
    name: 'glob', description: '文件模式匹配',
    parameters: { type: 'object', properties: { pattern: { type: 'string' } }, required: ['pattern'] },
    execute: async (args) => {
      const { glob } = await import('glob');
      return (await glob(args.pattern as string, { cwd: projectDir })).join('\n');
    },
  };
}
