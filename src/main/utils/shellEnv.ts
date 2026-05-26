import { execFileSync } from 'child_process';
import os from 'os';
import path from 'path';

let cachedEnv: NodeJS.ProcessEnv | null = null;

/** 从 Git for Windows 的 git.exe 路径推导 bundled ssh 所在 usr/bin */
export function extractGitUsrBinFromGitExe(gitExePath: string): string | null {
  const normalized = gitExePath.replace(/\//g, '\\');
  const match = normalized.match(/^(.*\\Git)\\cmd\\git\.exe$/i);
  if (!match) return null;
  return path.join(match[1], 'usr', 'bin');
}

function readWindowsUserEnv(): Record<string, string> {
  try {
    const script = [
      '$u = [Environment]::GetEnvironmentVariables("User")',
      '$u.GetEnumerator() | ForEach-Object {',
      '  $k = $_.Key -replace "`n"," "',
      '  $v = [string]$_.Value -replace "`n"," "',
      '  "$k=$v"',
      '}',
    ].join('; ');
    const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf-8',
      windowsHide: true,
      timeout: 8000,
    });
    const result: Record<string, string> = {};
    for (const line of out.split(/\r?\n/)) {
      const idx = line.indexOf('=');
      if (idx <= 0) continue;
      result[line.slice(0, idx)] = line.slice(idx + 1);
    }
    return result;
  } catch {
    return {};
  }
}

function readWindowsPathFromRegistry(): string {
  try {
    const script = "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')";
    const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf-8',
      windowsHide: true,
      timeout: 5000,
    });
    return out.trim();
  } catch {
    return '';
  }
}

function dedupePath(pathValue: string): string {
  const parts = pathValue.split(';').map(p => p.trim()).filter(Boolean);
  const seen = new Set<string>();
  return parts.filter(p => {
    const key = p.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join(';');
}

function resolveGitUsrBin(env: NodeJS.ProcessEnv): string | null {
  try {
    const out = execFileSync('where.exe', ['git'], {
      encoding: 'utf-8',
      windowsHide: true,
      env,
      timeout: 5000,
    });
    const first = out.split(/\r?\n/).map(l => l.trim()).find(Boolean);
    if (!first) return null;
    return extractGitUsrBinFromGitExe(first);
  } catch {
    return null;
  }
}

/** 供 git/ssh 等子进程使用的环境，补齐 GUI 启动时缺失的用户 PATH 与 HOME */
export function getChildProcessEnv(): NodeJS.ProcessEnv {
  if (cachedEnv) return cachedEnv;

  const env: NodeJS.ProcessEnv = { ...process.env };

  if (process.platform === 'win32') {
    const userEnv = readWindowsUserEnv();
    for (const [key, value] of Object.entries(userEnv)) {
      if (key.toUpperCase() === 'PATH') continue;
      if (value && (env[key] === undefined || env[key] === '')) {
        env[key] = value;
      }
    }

    const registryPath = readWindowsPathFromRegistry();
    if (registryPath) {
      env.PATH = dedupePath(registryPath);
    } else if (env.PATH) {
      env.PATH = dedupePath(env.PATH);
    }

    if (!env.HOME && env.USERPROFILE) {
      env.HOME = env.USERPROFILE;
    }

    const gitUsrBin = resolveGitUsrBin(env);
    if (gitUsrBin) {
      env.PATH = dedupePath(`${gitUsrBin};${env.PATH || ''}`);
    }

    env.GIT_TERMINAL_PROMPT = '0';
  } else {
    if (!env.HOME) env.HOME = os.homedir();
  }

  cachedEnv = env;
  return env;
}

/** 应用启动时同步到主进程，避免仅部分模块拿到完整环境 */
export function patchProcessEnv(): void {
  const enriched = getChildProcessEnv();
  for (const [key, value] of Object.entries(enriched)) {
    if (value !== undefined) process.env[key] = value;
  }
}

export function clearChildProcessEnvCache(): void {
  cachedEnv = null;
}
