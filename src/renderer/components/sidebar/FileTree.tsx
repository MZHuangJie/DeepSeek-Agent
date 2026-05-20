import React, { useCallback, useEffect } from 'react';
import { useFilesStore, FileNode } from '../../stores/files';
import { getFileIconInfo } from '../../utils/icons';

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
