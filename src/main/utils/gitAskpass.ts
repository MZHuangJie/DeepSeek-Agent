import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile, execFileSync } from 'child_process';
import { promisify } from 'util';
import { app, BrowserWindow, ipcMain } from 'electron';
import { getGitRemoteEnv } from './shellEnv';

const execFileAsync = promisify(execFile);

interface PendingAskpass {
  resolve: (password: string | null) => void;
  prompt: string;
  keyPath: string;
}

let requestCounter = 0;
const pendingRequests = new Map<string, PendingAskpass>();
const sessionPassphrases = new Map<string, string>();
let askpassQueue: Promise<unknown> = Promise.resolve();
let sshUnlockPromise: Promise<void> | null = null;
let preferredIdentityFile: string | null = null;

function getAskpassDir(): string {
  const candidates = [
    __dirname,
    path.join(app.getAppPath(), 'dist', 'main'),
    path.join(process.cwd(), 'dist', 'main'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'git-askpass.cjs'))) return dir;
  }
  return __dirname;
}

function getAskpassLauncherPath(): string {
  if (process.platform === 'win32') {
    return path.join(getAskpassDir(), 'git-askpass.cmd');
  }
  return path.join(getAskpassDir(), 'git-askpass.sh');
}

function normalizeKeyPath(keyPath: string): string {
  return keyPath.replace(/\\/g, '/');
}

function extractKeyPath(prompt: string): string {
  const single = prompt.match(/for key '([^']+)'/i);
  if (single) return normalizeKeyPath(single[1]);
  const double = prompt.match(/for key "([^"]+)"/i);
  if (double) return normalizeKeyPath(double[1]);
  return prompt.trim() || 'ssh-key';
}

function listDefaultPrivateKeys(env: NodeJS.ProcessEnv): string[] {
  const home = env.USERPROFILE || env.HOME || os.homedir();
  const sshDir = path.join(home, '.ssh');
  // id_rsa 优先：多数 GitHub 账户注册的是 RSA 公钥
  return ['id_rsa', 'id_ed25519', 'id_ecdsa']
    .map(name => path.join(sshDir, name))
    .filter(p => fs.existsSync(p));
}

async function isEncryptedPrivateKey(keyPath: string, env: NodeJS.ProcessEnv): Promise<boolean> {
  try {
    await execFileAsync('ssh-keygen', ['-y', '-P', '', '-f', keyPath], {
      env,
      encoding: 'utf-8',
      windowsHide: true,
      timeout: 5000,
      maxBuffer: 64 * 1024,
    });
    return false;
  } catch {
    return true;
  }
}

async function testRemoteGitAuth(cwd: string, env: NodeJS.ProcessEnv, timeoutMs = 8000): Promise<boolean> {
  try {
    await execFileAsync('git', ['ls-remote', '--heads', 'origin'], {
      cwd,
      env,
      encoding: 'utf-8',
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
    });
    return true;
  } catch {
    return false;
  }
}

function ensureSshAgentRunning(): void {
  if (process.platform !== 'win32') return;
  try {
    execFileSync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'if ((Get-Service ssh-agent -ErrorAction SilentlyContinue).Status -ne "Running") { Set-Service ssh-agent -StartupType Manual; Start-Service ssh-agent }',
    ], { windowsHide: true, timeout: 8000 });
  } catch {
    // ignore
  }
}

function enqueueAskpass<T>(task: () => Promise<T>): Promise<T> {
  const run = askpassQueue.then(task, task);
  askpassQueue = run.then(() => undefined, () => undefined);
  return run;
}

async function resolvePassphrase(prompt: string): Promise<string | null> {
  return enqueueAskpass(async () => {
    const keyPath = extractKeyPath(prompt);
    const cached = sessionPassphrases.get(keyPath);
    if (cached) return cached;

    const win = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
    if (!win) return null;

    const id = `askpass-${++requestCounter}-${Date.now()}`;

    return new Promise<string | null>((resolve) => {
      const timeout = setTimeout(() => {
        pendingRequests.delete(id);
        resolve(null);
      }, 120_000);

      pendingRequests.set(id, {
        prompt,
        keyPath,
        resolve: (password) => {
          clearTimeout(timeout);
          pendingRequests.delete(id);
          resolve(password);
        },
      });

      // 让出事件循环，避免主进程在 IPC 前后被同步 git 阻塞导致弹窗无法渲染
      setImmediate(() => {
        win.webContents.send('git:askpass-request', { id, prompt, keyPath });
      });
    });
  });
}

function buildIdentitySshCommand(keyPath: string): string {
  const p = normalizeKeyPath(keyPath);
  return `ssh -i "${p}" -o BatchMode=no -o ConnectTimeout=8 -o NumberOfPasswordPrompts=1 -o IdentitiesOnly=yes`;
}

/** 为 git/ssh 命令注入 askpass 环境 */
export async function buildAskpassEnv(baseEnv?: NodeJS.ProcessEnv, passphrase?: string): Promise<NodeJS.ProcessEnv> {
  const env: NodeJS.ProcessEnv = { ...(baseEnv || getGitRemoteEnv()) };
  env.DEEPSEEK_ELECTRON_EXE = process.execPath;
  env.SSH_ASKPASS = getAskpassLauncherPath();
  env.GIT_ASKPASS = getAskpassLauncherPath();
  env.SSH_ASKPASS_REQUIRE = 'force';
  if (passphrase) {
    env.DEEPSEEK_ASKPASS_SECRET = passphrase;
  } else if (preferredIdentityFile) {
    const cached = sessionPassphrases.get(normalizeKeyPath(preferredIdentityFile));
    if (cached) env.DEEPSEEK_ASKPASS_SECRET = cached;
  }
  if (process.platform === 'linux' && !env.DISPLAY) {
    env.DISPLAY = ':0';
  }
  return env;
}

export function applyGitIdentityEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  if (preferredIdentityFile) {
    env.GIT_SSH_COMMAND = buildIdentitySshCommand(preferredIdentityFile);
    const cached = sessionPassphrases.get(normalizeKeyPath(preferredIdentityFile));
    if (cached) env.DEEPSEEK_ASKPASS_SECRET = cached;
  }
  return env;
}

/** 远程 Git 操作前：先弹窗解锁，再异步短超时测试连接（不阻塞 UI） */
export async function ensureSshKeysUnlocked(cwd: string): Promise<void> {
  if (preferredIdentityFile && sessionPassphrases.has(normalizeKeyPath(preferredIdentityFile))) {
    let env = await buildAskpassEnv(
      getGitRemoteEnv(),
      sessionPassphrases.get(normalizeKeyPath(preferredIdentityFile)),
    );
    env = applyGitIdentityEnv(env);
    if (await testRemoteGitAuth(cwd, env, 8000)) return;
  }

  if (sshUnlockPromise) return sshUnlockPromise;

  sshUnlockPromise = (async () => {
    ensureSshAgentRunning();
    const baseEnv = getGitRemoteEnv();

    const keys = listDefaultPrivateKeys(baseEnv);
    if (keys.length === 0) {
      throw new Error('未在 ~/.ssh 找到 id_rsa / id_ed25519 私钥，请先配置 SSH 密钥');
    }

    // 阶段 1：仅本地检测，加密密钥立即弹窗（不做任何网络请求）
    for (const keyPath of keys) {
      if (!(await isEncryptedPrivateKey(keyPath, baseEnv))) continue;

      const displayPath = normalizeKeyPath(keyPath);
      if (sessionPassphrases.has(displayPath)) continue;

      const passphrase = await resolvePassphrase(`Enter passphrase for key '${displayPath}':`);
      if (!passphrase) {
        throw new Error('已取消输入 SSH 密钥密码');
      }
      sessionPassphrases.set(displayPath, passphrase);
    }

    // 阶段 2：异步短超时逐钥测试
    for (const keyPath of keys) {
      const displayPath = normalizeKeyPath(keyPath);
      const secret = sessionPassphrases.get(displayPath);
      const env = await buildAskpassEnv(baseEnv, secret);
      env.GIT_SSH_COMMAND = buildIdentitySshCommand(keyPath);

      if (await testRemoteGitAuth(cwd, env, 8000)) {
        preferredIdentityFile = keyPath;
        return;
      }
    }

    throw new Error('无法连接 GitHub。请确认 passphrase 正确，且对应公钥已添加到 GitHub。');
  })();

  try {
    await sshUnlockPromise;
  } finally {
    sshUnlockPromise = null;
  }
}

export function setupGitAskpassHandlers(): void {
  ipcMain.removeAllListeners('git:askpass-response');
  ipcMain.on(
    'git:askpass-response',
    (_event, payload: { id: string; password?: string; remember?: boolean; cancelled?: boolean }) => {
      const pending = pendingRequests.get(payload.id);
      if (!pending) return;

      if (payload.cancelled || !payload.password) {
        pending.resolve(null);
        return;
      }

      if (payload.remember !== false) {
        sessionPassphrases.set(normalizeKeyPath(pending.keyPath), payload.password);
      }

      pending.resolve(payload.password);
    },
  );
}
