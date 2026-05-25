import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFilesStore, FileNode } from '../../stores/files';
import { useBrowserStore } from '../../stores/browser';
import { useRefsStore } from '../../stores/refs';
import { getFileIconInfo } from '../../utils/icons';
import shared from '../../styles/components.module.css';
import styles from './FileTree.module.css';

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
  node: FileNode | null;
}

function TreeNode({ node, depth = 0, onContextMenu, onRefresh, renamingPath, setRenamingPath, selectedPath, onSelect }: { node: FileNode; depth?: number; onContextMenu: (e: React.MouseEvent, node: FileNode) => void; onRefresh: () => void; renamingPath: string | null; setRenamingPath: (p: string | null) => void; selectedPath: string | null; onSelect: (path: string) => void }) {
  const { openFile } = useFilesStore();
  const [expanded, setExpanded] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const isRenaming = renamingPath === node.path;
  const isSelected = selectedPath === node.path;

  const handleClick = useCallback(() => {
    onSelect(node.path);
    if (node.isDirectory) {
      setExpanded(!expanded);
    } else {
      openFile(node.path, node.name);
    }
  }, [node, expanded, openFile, onSelect]);

  useEffect(() => {
    if (isRenaming) {
      setRenameValue(node.name);
      setTimeout(() => inputRef.current?.select(), 50);
    }
  }, [isRenaming]);

  const commitRename = async () => {
    setRenamingPath(null);
    if (!renameValue.trim() || renameValue === node.name) return;
    try {
      const dir = node.path.substring(0, node.path.lastIndexOf('\\'));
      const newPath = dir + '\\' + renameValue;
      await window.api.files.rename(node.path, newPath);
      onRefresh();
    } catch (err: any) {
      alert(err.message || '重命名失败');
    }
  };

  return (
    <div>
      <div
        onClick={handleClick}
        onDoubleClick={(e) => { e.preventDefault(); if (node.isDirectory) return; setRenamingPath(node.path); }}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, node); }}
        className={styles.treeItem}
        data-path={node.path}
        style={{ paddingLeft: 8 + depth * 12, background: isSelected ? 'var(--bg-tertiary)' : undefined }}
      >
        <span className={styles.nodeIcon}>
          {node.isDirectory ? (
            <img src={expanded ? "/assets/展开.png" : "/assets/收起.png"} alt={expanded ? 'expanded' : 'collapsed'}
              className={styles.nodeIconImg} style={{ width: expanded ? 14 : 10, height: expanded ? 8 : 14 }} />
          ) : (
            <FileIcon name={node.name} />
          )}
        </span>
        {isRenaming ? (
          <input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingPath(null); }}
            onClick={(e) => e.stopPropagation()}
            className={styles.renameInput}
          />
        ) : (
          <span className={styles.nodeName}>{node.name}</span>
        )}
      </div>
      {expanded && node.children?.map(child => (
        <TreeNode key={child.path} node={child} depth={depth + 1} onContextMenu={onContextMenu} onRefresh={onRefresh}
          renamingPath={renamingPath} setRenamingPath={setRenamingPath}
          selectedPath={selectedPath} onSelect={onSelect} />
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
    <div className={styles.createRow}>
      <span className={styles.createIcon}><img src={isDirectory ? '/assets/文件夹.png' : '/assets/file.png'} alt="" style={{ width: 14, height: 14 }} /></span>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancel(); }}
        placeholder={isDirectory ? '文件夹名称' : '文件名称'}
        className={styles.createInput}
      />
    </div>
  );
}

export default function FileTree() {
  const { tree, setTree, currentWorkspace, recentWorkspaces, loadWorkspace, openWorkspace, selectAndOpenWorkspace, removeRecentWorkspace } = useFilesStore();
  const [showExplorer, setShowExplorer] = useState(true);
  const [showRecent, setShowRecent] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const contextMenuRef = useRef<FileNode | null>(null);
  const [creating, setCreating] = useState<{ parentPath: string; isDirectory: boolean } | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const treeAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadWorkspace(); }, []);

  useEffect(() => {
    if (currentWorkspace) loadProjectTree();
  }, [currentWorkspace, refreshKey]);

  useEffect(() => {
    const unsubscribe = window.api.files.onTreeChanged(() => { setRefreshKey(k => k + 1); });
    return () => { unsubscribe(); };
  }, []);

  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  // F2 重命名快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2' && selectedPath && !renamingPath) {
        e.preventDefault();
        setRenamingPath(selectedPath);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedPath, renamingPath]);

  const handleRefresh = () => setRefreshKey(k => k + 1);

  const loadProjectTree = async () => {
    try {
      const entries = await window.api.files.list('.');
      const buildTree = async (entries: any[]): Promise<FileNode[]> => {
        const nodes: FileNode[] = [];
        for (const e of entries) {
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
    contextMenuRef.current = node;
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  const handleBlankContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    contextMenuRef.current = null;
    setContextMenu({ x: e.clientX, y: e.clientY, node: null });
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
    <div className={styles.container}>
      <div className={`${styles.mainSection} ${showExplorer ? styles.mainSectionExpanded : styles.mainSectionCollapsed}`}>
        <div onClick={() => setShowExplorer(!showExplorer)} className={styles.sectionHeader}>
          <span><img src="/assets/文件夹.png" alt="" className={styles.sectionIcon} />资源管理器 ({workspaceName})</span>
          <div className={styles.headerActions}>
            <img src="/assets/refresh.png" alt="refresh" onClick={(e) => { e.stopPropagation(); handleRefresh(); }} title="刷新文件列表" className={styles.refreshIcon} />
            <span>{showExplorer ? '▼' : '▶'}</span>
          </div>
        </div>

        {showExplorer && (
          <div className={styles.mainSection}>
            <div className={styles.toolbar}>
              <button onClick={selectAndOpenWorkspace} className={styles.openBtn}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}>
                <img src="/assets/文件夹.png" alt="" style={{ width: 14, height: 14, marginRight: 4, verticalAlign: 'middle' }} /> 打开其他文件夹
              </button>
            </div>

            <div ref={treeAreaRef} className={styles.treeArea} onContextMenu={handleBlankContextMenu}>
              {tree.length === 0 ? (
                <div className={styles.emptyHint}>工作区无可见文件</div>
              ) : (
                tree.map(node => (
                  <TreeNode key={node.path} node={node} onContextMenu={handleContextMenu} onRefresh={handleRefresh}
                    renamingPath={renamingPath} setRenamingPath={setRenamingPath}
                    selectedPath={selectedPath} onSelect={setSelectedPath} />
                ))
              )}
              {creating && (
                <InlineCreate parentPath={creating.parentPath} isDirectory={creating.isDirectory} onDone={onCreated} onCancel={() => setCreating(null)} />
              )}

              {contextMenu && createPortal(
                <div className={styles.contextMenu} style={{ left: contextMenu.x, top: contextMenu.y }}
                  onClick={(e) => e.stopPropagation()}>
                  <ContextMenuItem label="新建文件" onClick={() => startCreate(false)} />
                  <ContextMenuItem label="新建文件夹" onClick={() => startCreate(true)} />
                  {contextMenu.node && (
                    <>
                      <div className={styles.contextDivider} />
                      <ContextMenuItem label="重命名" onClick={() => {
                        const node = contextMenuRef.current;
                        setContextMenu(null);
                        if (node) setRenamingPath(node.path);
                      }} />
                      <ContextMenuItem label="删除" onClick={handleDelete} />
                      <div className={styles.contextDivider} />
                      {contextMenu.node && !contextMenu.node.isDirectory && (
                        <ContextMenuItem label="添加到对话" onClick={() => {
                          useRefsStore.getState().addRefFile(contextMenuRef.current!.path);
                          setContextMenu(null);
                        }} />
                      )}
                      <ContextMenuItem label="在资源管理器中打开" onClick={() => {
                        const node = contextMenuRef.current;
                        if (node) window.api.files.showInExplorer(node.path);
                        setContextMenu(null);
                      }} />
                      {contextMenu.node && !contextMenu.node.isDirectory && (
                        <ContextMenuItem label="在浏览器中打开" onClick={() => {
                          const node = contextMenuRef.current;
                          if (node) {
                            const fileUrl = `file:///${node.path.replace(/\\/g, '/')}`;
                            useBrowserStore.getState().openUrl(fileUrl);
                          }
                          setContextMenu(null);
                        }} />
                      )}
                    </>
                  )}
                </div>,
                document.body
              )}
            </div>
          </div>
        )}
      </div>

      {/* RECENT WORKSPACES */}
      <div className={`${styles.recentSection} ${showRecent ? styles.recentSectionExpanded : styles.recentSectionCollapsed}`}>
        <div onClick={() => setShowRecent(!showRecent)} className={styles.sectionHeader}>
          <span><img src="/assets/recent.png" alt="" className={styles.sectionIcon} />最近打开的工作区</span>
          <span>{showRecent ? '▼' : '▶'}</span>
        </div>
        {showRecent && (
          <div className={styles.recentList}>
            {recentWorkspaces.length === 0 ? (
              <div className={styles.recentEmpty}>暂无历史打开记录</div>
            ) : (
              recentWorkspaces.map(p => {
                const name = p.split(/[\\/]/).pop() || p;
                const isActive = p === currentWorkspace;
                return (
                  <div key={p} className={styles.recentRow}>
                    <div onClick={() => openWorkspace(p)} className={`${shared.recentItem} ${isActive ? shared.recentItemActive : ''}`}
                    title={p}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><img src="/assets/文件夹.png" alt="" style={{ width: 14, height: 14 }} /> {name}</div>
                    <div className={styles.recentPath}>{p}</div>
                  </div>
                  <span onClick={(e) => { e.stopPropagation(); removeRecentWorkspace(p); }} className={`${shared.chipClose} ${styles.recentRemove}`}
                    title="从列表中移除">✕</span>
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
  return <div onClick={onClick} className={shared.menuItem} style={{ color: danger ? '#ef4444' : undefined }}>{label}</div>;
}
