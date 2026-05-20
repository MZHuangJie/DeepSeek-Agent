import https from 'https';

export interface PluginMeta {
  name: string;
  description: string;
  source: string;
  downloadUrl: string;
}

function githubGet(path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path,
      headers: {
        'User-Agent': 'MyCLI-Plugin-Manager',
        'Accept': 'application/vnd.github.v3+json',
      },
    };
    https.get(opts, (res) => {
      let data = '';
      res.on('data', (c: string) => { data += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`GitHub API ${res.statusCode}: ${data.slice(0, 200)}`));
          return;
        }
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

/**
 * 从 GitHub repo URL 发现所有 SKILL.md 文件。
 * 支持格式: "owner/repo" 或完整 URL。
 */
export async function discoverFromRepo(repoUrl: string): Promise<PluginMeta[]> {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  let owner: string;
  let repo: string;
  if (match) {
    owner = match[1];
    repo = match[2];
  } else {
    // "owner/repo" 格式
    const parts = repoUrl.replace(/^https?:\/\//, '').replace(/^github\.com\//, '').split('/');
    if (parts.length >= 2) {
      owner = parts[0];
      repo = parts[1].replace(/\.git$/, '');
    } else {
      throw new Error(`无法识别的仓库 URL: ${repoUrl}`);
    }
  }

  const skills: PluginMeta[] = [];

  // 查找仓库中所有 SKILL.md 文件（扫描常见目录）
  const searchPaths = ['skills', '.claude/skills', '.claude/plugins', 'plugins', ''];
  for (const searchPath of searchPaths) {
    try {
      const path = searchPath ? `/${searchPath}` : '';
      const contents = await githubGet(`/repos/${owner}/${repo}/contents${path}`);
      const dirs: string[] = [];
      for (const item of contents) {
        if (item.type === 'dir') {
          dirs.push(item.name);
        } else if (item.name === 'SKILL.md' || item.name.endsWith('.skill.md')) {
          // 这个目录可能包含 SKILL.md
          const parent = searchPath || '.';
          dirs.push(parent);
        }
      }
      // 检查每个子目录是否有 SKILL.md
      for (const dir of Array.from(new Set(dirs))) {
        if (dir === '.') continue;
        try {
          const dirPath = searchPath ? `${searchPath}/${dir}` : dir;
          const skillContent = await githubGet(`/repos/${owner}/${repo}/contents/${dirPath}/SKILL.md`);
          const content = Buffer.from(skillContent.content || '', 'base64').toString('utf-8');
          const frontmatter = parseFrontmatter(content);
          if (frontmatter.name) {
            skills.push({
              name: frontmatter.name,
              description: frontmatter.description || dir,
              source: `${owner}/${repo}`,
              downloadUrl: `https://raw.githubusercontent.com/${owner}/${repo}/main/${dirPath}/SKILL.md`,
            });
          }
        } catch {
          // 没有 SKILL.md，跳过
        }
      }
    } catch {
      // 目录不存在，继续下一个
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

/**
 * 下载 SKILL.md 内容
 */
export function downloadSkillContent(downloadUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = new URL(downloadUrl);
    const isHttps = url.protocol === 'https:';
    const mod = isHttps ? https : require('http');
    mod.get(downloadUrl, (res: any) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        downloadSkillContent(res.headers.location).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', (c: string) => { data += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`下载失败 ${res.statusCode}`));
          return;
        }
        resolve(data);
      });
    }).on('error', reject);
  });
}
