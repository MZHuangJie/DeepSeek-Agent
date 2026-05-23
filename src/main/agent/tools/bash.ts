import { checkDangerousCommand } from './security';
import type { ToolDef } from './index';

export function createBashTool(projectDir: string): ToolDef {
  return {
    name: 'bash', description: '执行终端命令',
    parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
    requiresConfirm: true,
    execute: async (args) => {
      const { spawnSync } = await import('child_process');
      const command = (args.command as string).trim();
      if (!command) throw new Error('命令不能为空');
      checkDangerousCommand(command);
      const result = spawnSync(command, [], { cwd: projectDir, encoding: 'utf-8', maxBuffer: 1024 * 1024, shell: true, timeout: 30000 });
      if (result.error) throw result.error;
      return (result.stdout || '') + (result.stderr ? `\n[stderr]\n${result.stderr}` : '');
    },
  };
}
