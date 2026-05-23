import { exec } from 'child_process';
import { checkDangerousCommand } from './security';
import type { ToolDef } from './index';

function execAsync(command: string, cwd: string, timeout: number): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    // Windows PowerShell 默认输出 GBK，强制设为 UTF-8
    const finalCommand = process.platform === 'win32'
      ? `[Console]::OutputEncoding=[Text.Encoding]::UTF8; ${command}`
      : command;

    exec(finalCommand, {
      cwd,
      timeout,
      maxBuffer: 1024 * 1024,
      encoding: 'utf-8',
      shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/sh',
    }, (err, stdout, stderr) => {
      if (err && !stdout && !stderr) reject(err);
      else resolve({ stdout: stdout || '', stderr: stderr || '' });
    });
  });
}

export function createBashTool(projectDir: string): ToolDef {
  return {
    name: 'bash', description: '执行终端命令',
    parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
    requiresConfirm: true,
    execute: async (args) => {
      const command = (args.command as string).trim();
      if (!command) throw new Error('命令不能为空');
      checkDangerousCommand(command);
      const { stdout, stderr } = await execAsync(command, projectDir, 30000);
      return stdout + (stderr ? `\n[stderr]\n${stderr}` : '');
    },
  };
}
