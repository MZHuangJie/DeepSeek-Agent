import React, { useCallback, useEffect, useState } from 'react';
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
          padding: '4px 8px 4px ' + (8 + depth * 12) + 'px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          color: 'var(--text-primary)',
          whiteSpace: 'nowrap',
          borderRadius: 4,
          margin: '1px 4px',
          transition: 'background 0.1s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
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
        <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.name}</span>
      </div>
      {expanded && node.children?.map(child => (
        <TreeNode key={child.path} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function FileTree() {
  const {
    tree,
    setTree,
    currentWorkspace,
    recentWorkspaces,
    loadWorkspace,
    openWorkspace,
    selectAndOpenWorkspace,
  } = useFilesStore();

  const [showExplorer, setShowExplorer] = useState(true);
  const [showRecent, setShowRecent] = useState(true);

  useEffect(() => {
    loadWorkspace();
  }, []);

  useEffect(() => {
    if (currentWorkspace) {
      loadProjectTree();
    }
  }, [currentWorkspace]);

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
        // 排序：文件夹在上，文件在下，组内按字母表升序排序
        nodes.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });
        return nodes;
      };
      const treeData = await buildTree(entries);
      setTree(treeData);
    } catch {
      // 文件树加载失败，保持空树
    }
  };

  const workspaceName = currentWorkspace
    ? currentWorkspace.split(/[\\/]/).pop() || currentWorkspace
    : '未打开文件夹';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', userSelect: 'none' }}>
      
      {/* SECTION 1: WORKSPACE EXPLORER */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: showExplorer ? 1 : '0 0 auto', overflow: 'hidden' }}>
        <div
          onClick={() => setShowExplorer(!showExplorer)}
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
            padding: '6px 12px',
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span>📂 资源管理器 ({workspaceName})</span>
          <span>{showExplorer ? '▼' : '▶'}</span>
        </div>

        {showExplorer && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={selectAndOpenWorkspace}
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#fff',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
              >
                📁 打开其他文件夹
              </button>
            </div>
            
            <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
              {tree.length === 0 ? (
                <div style={{ padding: '20px', color: 'var(--text-secondary)', fontSize: 12, textAlign: 'center' }}>
                  工作区无可见文件
                </div>
              ) : (
                tree.map(node => <TreeNode key={node.path} node={node} />)
              )}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: RECENT WORKSPACES */}
      <div style={{ display: 'flex', flexDirection: 'column', height: showRecent ? '180px' : 'auto', overflow: 'hidden', borderTop: '1px solid var(--border)' }}>
        <div
          onClick={() => setShowRecent(!showRecent)}
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
            padding: '6px 12px',
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span>🕒 最近打开的工作区</span>
          <span>{showRecent ? '▼' : '▶'}</span>
        </div>

        {showRecent && (
          <div style={{ flex: 1, overflow: 'auto', padding: '6px 0' }}>
            {recentWorkspaces.length === 0 ? (
              <div style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: 11, textAlign: 'center' }}>
                暂无历史打开记录
              </div>
            ) : (
              recentWorkspaces.map(p => {
                const name = p.split(/[\\/]/).pop() || p;
                const isActive = p === currentWorkspace;
                return (
                  <div
                    key={p}
                    onClick={() => openWorkspace(p)}
                    style={{
                      padding: '6px 10px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      color: isActive ? 'var(--accent)' : 'var(--text-primary)',
                      background: isActive ? 'var(--bg-tertiary)' : 'transparent',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      borderRadius: '4px',
                      margin: '2px 8px',
                      borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = isActive ? 'var(--bg-tertiary)' : 'transparent'; }}
                    title={p}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: isActive ? '700' : '500' }}>
                      📁 {name}
                    </div>
                    <div style={{ fontSize: '9px', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {p}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

    </div>
  );
}
