// 文本搜索 — grep 工具
// 参数: pattern(搜索模式), path(路径), glob(文件过滤)
// 递归搜索目录树，支持通配符
import fs from 'fs';
import path from 'path';
import { safeResolve } from './security';
import type { ToolDef } from './index';

function matchGlob(name: string, glob: string): boolean {
  if (glob === '*' || glob === '*.*') return true;
  if (glob.includes('{') && glob.includes('}')) {
    const prefix = glob.slice(0, glob.indexOf('{'));
    const suffix = glob.slice(glob.indexOf('}') + 1);
    const inner = glob.slice(glob.indexOf('{') + 1, glob.indexOf('}'));
    return inner.split(',').some(ext => matchGlob(name, prefix + ext + suffix));
  }
  const reStr = '^' + glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$';
  return new RegExp(reStr, 'i').test(name);
}

export function createGrepTool(projectDir: string): ToolDef {
  const maxResults = 200;
  function searchDir(dir: string, depth: number, results: string[], pattern: string, globPattern: string) {
    if (depth > 10 || results.length >= maxResults) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (results.length >= maxResults) break;
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) searchDir(full, depth + 1, results, pattern, globPattern);
      else if (entry.isFile() && matchGlob(entry.name, globPattern)) {
        try {
          const content = fs.readFileSync(full, 'utf-8');
          content.split('\n').forEach((line, i) => {
            if (line.includes(pattern)) results.push(`${path.relative(projectDir, full)}:${i + 1}: ${line.trim()}`);
          });
        } catch {}
      }
    }
  }

  return {
    name: 'grep',
    description: '在项目中搜索文本',
    parameters: {
      type: 'object',
      properties: { pattern: { type: 'string' }, path: { type: 'string' }, glob: { type: 'string' } },
      required: ['pattern'],
    },
    execute: async (args) => {
      const searchPath = args.path ? safeResolve(projectDir, args.path as string) : projectDir;
      const pattern = args.pattern as string;
      const globPattern = (args.glob as string) || '*';
      const results: string[] = [];
      searchDir(searchPath, 0, results, pattern, globPattern);
      return results.length > 0 ? results.join('\n') : '未找到匹配项';
    },
  };
}
