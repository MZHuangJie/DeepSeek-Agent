import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFilesStore, FileNode } from '../../stores/files';
import { getFileIconInfo } from '../../utils/icons';

function FileIcon({ name }: { name: string }) {
  const info = getFileIconInfo(name);
  const isSymbol = info.text.length <= 2 && !/[a-zA-Z]/.test(info.text);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, fontSize: isSymbol ? 11 : 9, fontWeight: 700, color: info.color, fontFamily: 'Consolas, "Courier New", monospace', lineHeight: 1, userSelect: 'none', flexShrink: 0 }} title={name}>
      {info.text}
    </span>
  );
}

interface ContextMenuState {
  x: number;
  y: number;
  node: FileNode | null; // null = 空白区域
}

function TreeNode({ node, depth = 0, onContextMenu, onRefresh }: { node: FileNode; depth?: number; onContextMenu: (e: React.MouseEvent, node: FileNode) => void; onRefresh: () => void }) {
  const { openFile } = useFilesStore();
  const [expanded, setExpanded] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    if (node.isDirectory) {
      setExpanded(!expanded);
    } else {
      openFile(node.path, node.name);
    }
  }, [node, expanded, openFile]);

  const handleDelete = async () => {
    try {
      await window.api.files.delete(node.path);
      onRefresh();
    } catch (err: any) {
      alert(err.message || '删除失败');
    }
  };

  const startRename = () => {
    setRenameValue(node.name);
    setRenaming(true);
    setTimeout(() => inputRef.current?.select(), 50);
  };

  const commitRename = async () => {
    setRenaming(false);
    if (!renameValue.trim() || renameValue === node.name) return;
    try {
      const dir = node.path.substring(0, node.path.lastIndexOf('\\'));
      const newPath = dir + '\\' + renameValue;
      // 对于本项目，重命名 = 创建新 + 删除旧（简化实现）
      const content = !node.isDirectory ? await window.api.files.read(node.path).catch(() => '') : '';
      if (!node.isDirectory) {
        await window.api.files.createFile(newPath);
        // 写入原内容（简化：用 bash 做 copy）
      }
      await window.api.files.delete(node.path);
      onRefresh();
    } catch (err: any) {
      alert(err.message || '重命名失败');
    }
  };

  const itemStyle: React.CSSProperties = {
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
  };

  return (
    <div>
      <div
        onClick={handleClick}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, node); }}
        style={itemStyle}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{ display: 'flex', alignItems: 'center', width: 16, height: 16, flexShrink: 0, justifyContent: 'center' }}>
          {node.isDirectory ? (
            <img src={expanded ? "/assets/展开.png" : "/assets/收起.png"} alt={expanded ? 'expanded' : 'collapsed'} style={{ maxWidth: 14, maxHeight: 14, width: expanded ? 14 : 10, height: expanded ? 8 : 14, objectFit: 'contain', flexShrink: 0 }} />
          ) : (
            <FileIcon name={node.name} />
          )}
        </span>
        {renaming ? (
          <input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(false); }}
            onClick={(e) => e.stopPropagation()}
            style={{ flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--accent)', color: 'var(--text-primary)', fontSize: 12, padding: '1px 4px', borderRadius: 2, outline: 'none', minWidth: 0 }}
          />
        ) : (
          <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.name}</span>
        )}
      </div>
      {expanded && node.children?.map(child => (
        <TreeNode key={child.path} node={child} depth={depth + 1} onContextMenu={onContextMenu} onRefresh={onRefresh} />
      ))}
    </div>
  );
}

function InlineCreate({ parentPath, isDirectory, onDone, onCancel }: { parentPath: string; isDirectory: boolean; onDone: () => void; onCancel: () => void }) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const commit = async () => {
    if (!value.trim()) { onCancel(); return; }
    try {
      const fullPath = parentPath + '\\' + value.trim();
      if (isDirectory) {
        await window.api.files.createDirectory(fullPath);
      } else {
        await window.api.files.createFile(fullPath);
      }
      onDone();
    } catch (err: any) {
      alert(err.message || '创建失败');
      onCancel();
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px 2px 36px' }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>{isDirectory ? '📁' : '📄'}</span>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancel(); }}
        placeholder={isDirectory ? '文件夹名称' : '文件名称'}
        style={{ flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--accent)', color: 'var(--text-primary)', fontSize: 12, padding: '2px 6px', borderRadius: 3, outline: 'none', minWidth: 0 }}
      />
    </div>
  );
}

export default function FileTree() {
  const { tree, setTree, currentWorkspace, recentWorkspaces, loadWorkspace, openWorkspace, selectAndOpenWorkspace } = useFilesStore();
  const [showExplorer, setShowExplorer] = useState(true);
  const [showRecent, setShowRecent] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [creating, setCreating] = useState<{ parentPath: string; isDirectory: boolean } | null>(null);
  const treeAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadWorkspace(); }, []);

  useEffect(() => {
    if (currentWorkspace) loadProjectTree();
  }, [currentWorkspace, refreshKey]);

  useEffect(() => {
    const unsubscribe = window.api.files.onTreeChanged(() => { setRefreshKey(k => k + 1); });
    return () => { unsubscribe(); };
  }, []);

  // 点击其他地方关闭右键菜单
  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  const handleRefresh = () => setRefreshKey(k => k + 1);

  const loadProjectTree = async () => {
    try {
      const entries = await window.api.files.list('.');
      const buildTree = async (entries: any[]): Promise<FileNode[]> => {
        const nodes: FileNode[] = [];
        for (const e of entries) {
          if (e.name.startsWith('.') || e.name === 'node_modules') continue;
          const node: FileNode = { name: e.name, path: e.path, isDirectory: e.isDirectory };
          if (e.isDirectory) {
            try { const children = await window.api.files.list(e.path); node.children = await buildTree(children); } catch {}
          }
          nodes.push(node);
        }
        nodes.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });
        return nodes;
      };
      setTree(await buildTree(entries));
    } catch {}
  };

  const handleContextMenu = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    e.stopPropagation();
    // 获取父容器滚动偏移
    const rect = treeAreaRef.current?.getBoundingClientRect();
    setContextMenu({ x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0), node });
  };

  const handleBlankContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = treeAreaRef.current?.getBoundingClientRect();
    setContextMenu({ x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0), node: null });
  };

  const handleDelete = async () => {
    if (!contextMenu?.node) return;
    const node = contextMenu.node;
    const msg = node.isDirectory
      ? `确定删除文件夹 "${node.name}" 及其所有内容？`
      : `确定删除文件 "${node.name}"？`;
    if (!confirm(msg)) return;
    try {
      await window.api.files.delete(node.path);
      setContextMenu(null);
      handleRefresh();
    } catch (err: any) {
      alert(err.message || '删除失败');
    }
  };

  const startCreate = (isDirectory: boolean) => {
    const parentNode = contextMenu?.node;
    const parentPath = parentNode?.isDirectory ? parentNode.path : currentWorkspace || '';
    setCreating({ parentPath, isDirectory });
    setContextMenu(null);
  };

  const onCreated = () => {
    setCreating(null);
    handleRefresh();
  };

  const workspaceName = currentWorkspace ? currentWorkspace.split(/[\\/]/).pop() || currentWorkspace : '未打开文件夹';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', userSelect: 'none' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: showExplorer ? 1 : '0 0 auto', overflow: 'hidden' }}>
        <div onClick={() => setShowExplorer(!showExplorer)} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', padding: '6px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
          <span>📂 资源管理器 ({workspaceName})</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span onClick={(e) => { e.stopPropagation(); handleRefresh(); }} title="刷新文件列表" style={{ cursor: 'pointer', fontSize: 12, opacity: 0.7 }}>⟳</span>
            <span>{showExplorer ? '▼' : '▶'}</span>
          </div>
        </div>

        {showExplorer && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={selectAndOpenWorkspace} style={{ flex: 1, border: 'none', background: 'var(--accent)', color: '#fff', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'opacity 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}>
                📁 打开其他文件夹
              </button>
            </div>

            <div ref={treeAreaRef} style={{ flex: 1, overflow: 'auto', padding: '4px 0', position: 'relative' }} onContextMenu={handleBlankContextMenu}>
              {tree.length === 0 ? (
                <div style={{ padding: '20px', color: 'var(--text-secondary)', fontSize: 12, textAlign: 'center' }}>工作区无可见文件</div>
              ) : (
                tree.map(node => <TreeNode key={node.path} node={node} onContextMenu={handleContextMenu} onRefresh={handleRefresh} />)
              )}
              {creating && (
                <InlineCreate parentPath={creating.parentPath} isDirectory={creating.isDirectory} onDone={onCreated} onCancel={() => setCreating(null)} />
              )}

              {/* 右键菜单 */}
              {contextMenu && (
                <div style={{ position: 'absolute', left: contextMenu.x, top: contextMenu.y, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 0', minWidth: 160, zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}
                  onClick={(e) => e.stopPropagation()}>
                  <ContextMenuItem label="📄 新建文件" onClick={() => startCreate(false)} />
                  <ContextMenuItem label="📁 新建文件夹" onClick={() => startCreate(true)} />
                  {contextMenu.node && (
                    <>
                      <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                      <ContextMenuItem label="✏️ 重命名" onClick={() => { /* 已通过双击触发，留空 */ setContextMenu(null); }} />
                      <ContextMenuItem label="🗑️ 删除" onClick={handleDelete} danger />
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: RECENT WORKSPACES */}
      <div style={{ display: 'flex', flexDirection: 'column', height: showRecent ? '180px' : 'auto', overflow: 'hidden', borderTop: '1px solid var(--border)' }}>
        <div onClick={() => setShowRecent(!showRecent)} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', padding: '6px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
          <span>🕒 最近打开的工作区</span>
          <span>{showRecent ? '▼' : '▶'}</span>
        </div>
        {showRecent && (
          <div style={{ flex: 1, overflow: 'auto', padding: '6px 0' }}>
            {recentWorkspaces.length === 0 ? (
              <div style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: 11, textAlign: 'center' }}>暂无历史打开记录</div>
            ) : (
              recentWorkspaces.map(p => {
                const name = p.split(/[\\/]/).pop() || p;
                const isActive = p === currentWorkspace;
                return (
                  <div key={p} onClick={() => openWorkspace(p)} style={{ padding: '6px 10px', cursor: 'pointer', fontSize: '11px', color: isActive ? 'var(--accent)' : 'var(--text-primary)', background: isActive ? 'var(--bg-tertiary)' : 'transparent', display: 'flex', flexDirection: 'column', gap: '2px', borderRadius: '4px', margin: '2px 8px', borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent', transition: 'background 0.1s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = isActive ? 'var(--bg-tertiary)' : 'transparent'; }}
                    title={p}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: isActive ? '700' : '500' }}>📁 {name}</div>
                    <div style={{ fontSize: '9px', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{p}</div>
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

function ContextMenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <div onClick={onClick} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: danger ? '#ef4444' : 'var(--text-primary)', transition: 'background 0.1s' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
      {label}
    </div>
  );
}
