import { Worker } from 'worker_threads';
import path from 'path';

interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const FORBIDDEN_SHELL = /[;&|`$<>()\r\n]|^\s*$/;
const ALLOWED_PREFIX = /^(node|npm|npx|echo)\s+/i;

/** 校验插件 hook 命令，禁止任意 shell 注入 */
export function validatePluginHook(hook: string): string {
  const trimmed = hook.trim();
  if (!trimmed) throw new Error('插件 hook 不能为空');
  if (trimmed.length > 500) throw new Error('插件 hook 过长（最多 500 字符）');
  if (FORBIDDEN_SHELL.test(trimmed)) {
    throw new Error('插件 hook 包含不允许的 shell 元字符');
  }
  if (!ALLOWED_PREFIX.test(trimmed)) {
    throw new Error('插件 hook 仅允许 node、npm、npx、echo 开头的命令');
  }
  return trimmed;
}

export function executePluginHook(
  pluginName: string,
  hook: string,
  cwd?: string
): Promise<SandboxResult> {
  const validatedHook = validatePluginHook(hook);

  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const worker = new Worker(
      path.join(__dirname, 'plugin-worker.js'),
      { workerData: { pluginName, hook: validatedHook, cwd: cwd || process.cwd() } }
    );

    const timeout = setTimeout(() => {
      worker.terminate();
      settle(() => reject(new Error(`插件 ${pluginName} hook 执行超时（30秒）`)));
    }, 30_000);

    worker.on('message', (result: SandboxResult) => {
      clearTimeout(timeout);
      settle(() => resolve(result));
    });
    worker.on('error', (err) => {
      clearTimeout(timeout);
      settle(() => reject(err));
    });
    worker.on('exit', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        settle(() => reject(new Error(`插件进程退出码 ${code}`)));
      }
    });
  });
}
