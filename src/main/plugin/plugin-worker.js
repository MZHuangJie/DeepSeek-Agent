const { workerData, parentPort } = require('worker_threads');
const { spawnSync } = require('child_process');

const { hook, cwd } = workerData;

const FORBIDDEN_SHELL = /[;&|`$<>()\r\n]|^\s*$/;
const ALLOWED_PREFIX = /^(node|npm|npx|echo)\s+/i;

function validateHook(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) throw new Error('插件 hook 不能为空');
  if (trimmed.length > 500) throw new Error('插件 hook 过长');
  if (FORBIDDEN_SHELL.test(trimmed)) throw new Error('插件 hook 包含不允许的 shell 元字符');
  if (!ALLOWED_PREFIX.test(trimmed)) throw new Error('插件 hook 仅允许 node/npm/npx/echo 开头的命令');
  return trimmed;
}

try {
  const validatedHook = validateHook(hook);
  const parts = validatedHook.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  const executable = process.platform === 'win32' && ['npm', 'npx', 'node'].includes(cmd)
    ? `${cmd}.cmd`
    : parts[0];

  const result = spawnSync(executable, args, {
    cwd,
    encoding: 'utf-8',
    maxBuffer: 1024 * 1024,
    timeout: 25_000,
    shell: false,
    windowsHide: true,
  });

  parentPort.postMessage({
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status ?? (result.error ? 1 : 0),
  });
} catch (err) {
  parentPort.postMessage({
    stdout: '',
    stderr: err.message || String(err),
    exitCode: 1,
  });
}
