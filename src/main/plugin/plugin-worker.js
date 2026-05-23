const { workerData, parentPort } = require('worker_threads');
const { execSync } = require('child_process');

const { pluginName, hook, cwd } = workerData;

try {
  const stdout = execSync(hook, {
    cwd,
    encoding: 'utf-8',
    maxBuffer: 1024 * 1024, // 1MB
    timeout: 25_000,
    shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/sh',
  });
  parentPort.postMessage({ stdout: stdout || '', stderr: '', exitCode: 0 });
} catch (err) {
  parentPort.postMessage({
    stdout: err.stdout || '',
    stderr: err.stderr || err.message || '',
    exitCode: err.status || 1,
  });
}
