import fs from 'fs';
import path from 'path';

const MAX_CONTEXT_FILES = 20;
const MAX_CONTEXT_SIZE = 8000;

export function buildProjectContext(projectDir: string): string {
  const parts: string[] = [];
  const importantFiles = findImportantFiles(projectDir);

  parts.push(`项目目录: ${projectDir}`);
  parts.push('');

  let totalSize = 0;
  for (const file of importantFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const truncated = content.length > 500
        ? content.slice(0, 500) + '\n... (截断)'
        : content;
      parts.push(`--- ${path.relative(projectDir, file)} ---`);
      parts.push(truncated);
      totalSize += truncated.length;
      if (totalSize > MAX_CONTEXT_SIZE) break;
    } catch {}
  }

  return parts.join('\n');
}

function findImportantFiles(dir: string): string[] {
  const important = new Set([
    'package.json', 'tsconfig.json', 'README.md',
    '.env.example', 'docker-compose.yml', 'Makefile',
  ]);
  const found: string[] = [];

  function walk(d: string, depth: number) {
    if (depth > 3 || found.length > MAX_CONTEXT_FILES) return;
    try {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const full = path.join(d, entry.name);
        if (entry.isFile() && important.has(entry.name)) {
          found.push(full);
        } else if (entry.isDirectory()) {
          walk(full, depth + 1);
        }
      }
    } catch {}
  }

  walk(dir, 0);
  return found;
}
