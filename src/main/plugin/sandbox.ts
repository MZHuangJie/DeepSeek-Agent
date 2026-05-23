import { Worker } from 'worker_threads';
import path from 'path';

interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function executePluginHook(
  pluginName: string,
  hook: string,
  cwd?: string
): Promise<SandboxResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      path.join(__dirname, 'plugin-worker.js'),
      { workerData: { pluginName, hook, cwd: cwd || process.cwd() } }
    );

    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error(`插件 ${pluginName} hook 执行超时（30秒）`));
    }, 30_000);

    worker.on('message', (result: SandboxResult) => {
      clearTimeout(timeout);
      resolve(result);
    });
    worker.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    worker.on('exit', (code) => {
      clearTimeout(timeout);
      if (code !== 0) reject(new Error(`插件进程退出码 ${code}`));
    });
  });
}
