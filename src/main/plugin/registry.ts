import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';

export interface PluginMeta {
  name: string;
  description: string;
  source: string;
  downloadUrl: string;
}

const CACHE_DIR = path.join(os.tmpdir(), 'deepseek-agent-plugin-cache');

function execAsync(cmd: string, opts: { cwd: string; timeout?: number }): Promise<void> {
  return new Promise((resolve, reject) => {
    exec(cmd, {
      ...opts,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function parseOwnerRepo(repoUrl: string): { owner: string; repo: string } {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  const parts = repoUrl.replace(/^https?:\/\//, '').replace(/^github\.com\//, '').split('/');
  if (parts.length >= 2) {
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') };
  }
  throw new Error(`无法识别的仓库 URL: ${repoUrl}`);
}

async function cloneOrPull(owner: string, repo: string): Promise<string> {
  const url = `https://github.com/${owner}/${repo}.git`;
  const dir = path.join(CACHE_DIR, `${owner}_${repo}`);

  if (fs.existsSync(dir)) {
    try {
      await execAsync('git pull --ff-only', { cwd: dir, timeout: 30000 });
    } catch {
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      await execAsync(`git clone --depth 1 "${url}" .`, { cwd: dir, timeout: 60000 });
    }
  } else {
    fs.mkdirSync(dir, { recursive: true });
    await execAsync(`git clone --depth 1 "${url}" .`, { cwd: dir, timeout: 60000 });
  }

  return dir;
}

export async function discoverFromRepo(repoUrl: string): Promise<PluginMeta[]> {
  const { owner, repo } = parseOwnerRepo(repoUrl);
  const repoDir = await cloneOrPull(owner, repo);

  const skills: PluginMeta[] = [];
  const searchPaths = ['skills', '.claude/skills', '.claude/plugins', 'plugins', ''];

  for (const searchPath of searchPaths) {
    const baseDir = searchPath ? path.join(repoDir, searchPath) : repoDir;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(baseDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillFile = path.join(baseDir, entry.name, 'SKILL.md');
      let content: string;
      try {
        content = fs.readFileSync(skillFile, 'utf-8');
      } catch {
        continue;
      }
      const fm = parseFrontmatter(content);
      if (!fm.name) continue;

      const relativePath = searchPath ? `${searchPath}/${entry.name}` : entry.name;
      skills.push({
        name: fm.name,
        description: fm.description || entry.name,
        source: `${owner}/${repo}`,
        downloadUrl: path.join(repoDir, relativePath, 'SKILL.md'),
      });
    }
  }

  return skills;
}

function parseFrontmatter(content: string): { name: string; description: string } {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return { name: '', description: '' };
  const yaml = match[1];
  const name = (yaml.match(/^name:\s*(.+)$/m) || [])[1]?.trim() || '';
  const description = (yaml.match(/^description:\s*(.+)$/m) || [])[1]?.trim() || '';
  return { name, description };
}

export function downloadSkillContent(filePath: string): Promise<string> {
  return Promise.resolve(fs.readFileSync(filePath, 'utf-8'));
}
