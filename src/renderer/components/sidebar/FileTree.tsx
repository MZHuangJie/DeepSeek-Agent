import React, { useCallback, useEffect } from 'react';
import { useFilesStore, FileNode } from '../../stores/files';

interface FileIconInfo {
  text: string;
  color: string;
  bg?: string;
}

function getFileIconInfo(name: string): FileIconInfo {
  const lower = name.toLowerCase();
  const ext = name.split('.').pop()?.toLowerCase() || '';

  // specific filenames first
  if (lower === 'package.json') return { text: '{ }', color: '#e5c07b' };
  if (lower === 'tsconfig.json') return { text: '{ }', color: '#4fc1ff' };
  if (lower === '.gitignore') return { text: '◆', color: '#808080' };
  if (lower === '.npmrc' || lower === 'npm') return { text: 'npm', color: '#e8423f' };
  if (lower === 'dockerfile') return { text: '🐳', color: '#2496ed' };
  if (lower === 'makefile') return { text: 'Mk', color: '#d4d4d4' };
  if (lower === 'readme.md') return { text: 'M↓', color: '#519aba' };

  // by extension
  const map: Record<string, FileIconInfo> = {
    ts: { text: 'TS', color: '#4fc1ff' },
    tsx: { text: 'TS', color: '#4fc1ff' },
    js: { text: 'JS', color: '#f1e05a' },
    jsx: { text: 'JS', color: '#f1e05a' },
    mjs: { text: 'JS', color: '#f1e05a' },
    json: { text: '{ }', color: '#4fc1ff' },
    css: { text: '#', color: '#42a5f5' },
    scss: { text: 'S', color: '#f06292' },
    sass: { text: 'S', color: '#f06292' },
    less: { text: 'less', color: '#2b4c7e' },
    html: { text: '<>', color: '#e44d26' },
    htm: { text: '<>', color: '#e44d26' },
    xml: { text: '<>', color: '#ff6600' },
    svg: { text: 'SVG', color: '#ffca28' },
    png: { text: '🖼', color: '#c586c0' },
    jpg: { text: '🖼', color: '#c586c0' },
    jpeg: { text: '🖼', color: '#c586c0' },
    gif: { text: '🖼', color: '#c586c0' },
    webp: { text: '🖼', color: '#c586c0' },
    ico: { text: '🖼', color: '#c586c0' },
    md: { text: 'M↓', color: '#519aba' },
    mdx: { text: 'M↓', color: '#519aba' },
    py: { text: 'PY', color: '#ffd845' },
    pyc: { text: 'PY', color: '#ffd845' },
    rs: { text: 'RS', color: '#dea584' },
    go: { text: 'GO', color: '#00add8' },
    java: { text: 'JA', color: '#b07219' },
    c: { text: 'C', color: '#555555' },
    cpp: { text: 'C+', color: '#f34b7d' },
    h: { text: 'H', color: '#a8b9cc' },
    cs: { text: 'C#', color: '#178600' },
    php: { text: 'PHP', color: '#4f5d95' },
    rb: { text: 'RB', color: '#701516' },
    swift: { text: 'SW', color: '#ffac45' },
    kt: { text: 'KT', color: '#a97bff' },
    dart: { text: 'DT', color: '#00b4ab' },
    lua: { text: 'lua', color: '#000080' },
    sh: { text: 'SH', color: '#89e051' },
    bash: { text: 'SH', color: '#89e051' },
    zsh: { text: 'SH', color: '#89e051' },
    ps1: { text: 'PS', color: '#012456' },
    sql: { text: 'SQL', color: '#dad8d8' },
    yaml: { text: 'YML', color: '#f71e8a' },
    yml: { text: 'YML', color: '#f71e8a' },
    toml: { text: 'TOML', color: '#9c4121' },
    ini: { text: 'ini', color: '#d1d5da' },
    env: { text: 'ENV', color: '#f1e05a' },
    lock: { text: '🔒', color: '#f1e05a' },
    log: { text: 'LOG', color: '#d1d5da' },
    dockerfile: { text: '🐳', color: '#2496ed' },
    gitignore: { text: '◆', color: '#808080' },
    gitattributes: { text: '◆', color: '#808080' },
    editorconfig: { text: 'Ed', color: '#fefefe' },
    eslintignore: { text: 'Es', color: '#4b32c3' },
    prettierrc: { text: 'Pr', color: '#f7b93e' },
    babelrc: { text: 'B', color: '#f9dc3e' },
    webpack: { text: 'Wp', color: '#8dd6f9' },
    vite: { text: 'V', color: '#646cff' },
  };

  return map[ext] || { text: ext.slice(0, 3).toUpperCase(), color: '#d4d4d4' };
}

function FileIcon({ name }: { name: string }) {
  const info = getFileIconInfo(name);
  const isSymbol = info.text.length <= 2 && !/[a-zA-Z]/.test(info.text);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 16,
        height: 16,
        fontSize: isSymbol ? 11 : 9,
        fontWeight: 700,
        color: info.color,
        fontFamily: 'Consolas, "Courier New", monospace',
        lineHeight: 1,
        userSelect: 'none',
        flexShrink: 0,
      }}
      title={name}
    >
      {info.text}
    </span>
  );
}

function TreeNode({ node, depth = 0 }: { node: FileNode; depth?: number }) {
  const { openFile } = useFilesStore();
  const [expanded, setExpanded] = React.useState(depth < 1);

  const handleClick = useCallback(() => {
    if (node.isDirectory) {
      setExpanded(!expanded);
    } else {
      openFile(node.path, node.name);
    }
  }, [node, expanded, openFile]);

  return (
    <div>
      <div
        onClick={handleClick}
        style={{
          padding: '3px 8px 3px ' + (8 + depth * 12) + 'px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 12,
          color: 'var(--text-primary)',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', width: 16, height: 16, flexShrink: 0, justifyContent: 'center' }}>
          {node.isDirectory ? (
            <img
              src={expanded ? "/assets/展开.png" : "/assets/收起.png"}
              alt={expanded ? 'expanded' : 'collapsed'}
              style={{
                maxWidth: 14,
                maxHeight: 14,
                width: expanded ? 14 : 10,
                height: expanded ? 8 : 14,
                objectFit: 'contain',
                flexShrink: 0,
              }}
            />
          ) : (
            <FileIcon name={node.name} />
          )}
        </span>
        <span style={{ fontSize: 12 }}>{node.name}</span>
      </div>
      {expanded && node.children?.map(child => (
        <TreeNode key={child.path} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function FileTree() {
  const { tree, setTree } = useFilesStore();

  useEffect(() => {
    loadProjectTree();
  }, []);

  const loadProjectTree = async () => {
    try {
      const entries = await window.api.files.list('.');
      const buildTree = async (entries: any[]): Promise<FileNode[]> => {
        const nodes: FileNode[] = [];
        for (const e of entries) {
          if (e.name.startsWith('.') || e.name === 'node_modules') continue;
          const node: FileNode = { name: e.name, path: e.path, isDirectory: e.isDirectory };
          if (e.isDirectory) {
            try {
              const children = await window.api.files.list(e.path);
              node.children = await buildTree(children);
            } catch {}
          }
          nodes.push(node);
        }
        return nodes;
      };
      const treeData = await buildTree(entries);
      setTree(treeData);
    } catch {
      // 文件树加载失败，保持空树
    }
  };

  return (
    <div style={{ overflow: 'auto', height: '100%', padding: '4px 0' }}>
      {tree.map(node => <TreeNode key={node.path} node={node} />)}
    </div>
  );
}
