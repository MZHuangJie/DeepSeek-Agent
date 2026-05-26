import React, { useCallback, useEffect, useRef, useState } from 'react';
import DiffView from '../editor/DiffView';
import GitGraph from '../git/GitGraph';
import { useFilesStore } from '../../stores/files';
import { getFileIconInfo } from '../../utils/icons';
import styles from './GitPanel.module.css';

interface GitFileEntry { path: string; status: string; }

interface GitStatus {
  isRepo: boolean;
  branch: string;
  upstream?: string;
  hasUpstream: boolean;
  detached: boolean;
  ahead: number;
  behind: number;
  staged: GitFileEntry[];
  unstaged: GitFileEntry[];
  untracked: GitFileEntry[];
  conflicts: GitFileEntry[];
  clean: boolean;
}

interface GitBranchInfo { name: string; current: boolean; remote: boolean; }

const BUSY_LABELS: Record<string, string> = {
  pull: '正在 Pull…',
  push: '正在 Push…',
  sync: '正在 Sync…',
  fetch: '正在 Fetch…',
  rebase: '正在 Rebase Pull…',
  publish: '正在发布分支…',
  commit: '正在提交…',
  checkout: '正在切换分支…',
  branch: '正在创建分支…',
  init: '正在初始化仓库…',
  'stage-all': '正在暂存全部文件…',
  'unstage-all': '正在取消全部暂存…',
  'discard-all': '正在还原更改…',
  clean: '正在清理未跟踪文件…',
  stash: '正在 Stash…',
  'stash-pop': '正在 Pop Stash…',
};

const REMOTE_BUSY_OPS = new Set(['pull', 'push', 'sync', 'fetch', 'rebase', 'publish']);

const SUCCESS_TOAST: Record<string, string> = {
  pull: 'Pull 成功',
  push: 'Push 成功',
  sync: 'Sync 成功',
  fetch: 'Fetch 成功',
  rebase: 'Rebase Pull 成功',
  publish: '分支已发布',
  commit: '提交成功',
  checkout: '已切换分支',
  branch: '分支已创建',
  init: '仓库已初始化',
  'stage-all': '已全部暂存',
  'unstage-all': '已全部取消暂存',
  'discard-all': '已还原更改',
  clean: '已清理未跟踪文件',
  stash: '已 Stash',
  'stash-pop': '已 Pop Stash',
};

function getBusyText(label: string): string {
  const text = BUSY_LABELS[label] || '处理中…';
  return REMOTE_BUSY_OPS.has(label) ? `${text}（如需密码将弹出对话框）` : text;
}

function basename(p: string): string {
  return p.split(/[/\\]/).pop() || p;
}

function toAbsPath(workspace: string, rel: string): string {
  const sep = workspace.includes('\\') ? '\\' : '/';
  return `${workspace}${sep}${rel.split('/').join(sep)}`;
}

function displayStatus(status: string): { letter: string; color: string } {
  if (status === '?') return { letter: 'U', color: '#4ade80' };
  if (status === 'A') return { letter: 'A', color: '#4ade80' };
  if (status === 'D' || status.includes('U')) return { letter: 'D', color: '#f87171' };
  return { letter: 'M', color: '#fbbf24' };
}

function getLanguage(name: string): string {
  if (name.endsWith('.ts') || name.endsWith('.tsx')) return 'typescript';
  if (name.endsWith('.js') || name.endsWith('.jsx')) return 'javascript';
  if (name.endsWith('.py')) return 'python';
  if (name.endsWith('.json')) return 'json';
  if (name.endsWith('.md')) return 'markdown';
  if (name.endsWith('.css')) return 'css';
  if (name.endsWith('.html')) return 'html';
  if (name.endsWith('.yml') || name.endsWith('.yaml')) return 'yaml';
  return 'text';
}

function CollapsibleSection({
  title,
  count,
  collapsed,
  onToggle,
  tools,
  children,
}: {
  title: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  tools?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader} onClick={onToggle}>
        <div className={styles.sectionHeaderLeft}>
          <span className={styles.chevron}>{collapsed ? '▸' : '▾'}</span>
          <span className={styles.sectionTitle}>{title}</span>
          <span className={styles.sectionCount}>({count})</span>
        </div>
        {tools && (
          <div className={styles.sectionTools} onClick={e => e.stopPropagation()}>
            {tools}
          </div>
        )}
      </div>
      {!collapsed && children}
    </div>
  );
}

export default function GitPanel() {
  const { currentWorkspace, openFile } = useFilesStore();
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [branches, setBranches] = useState<GitBranchInfo[]>([]);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedStaged, setSelectedStaged] = useState(false);
  const [diffContent, setDiffContent] = useState<{
    original: string;
    modified: string;
    originalLabel: string;
    modifiedLabel: string;
  } | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [syncMenuOpen, setSyncMenuOpen] = useState(false);
  const [showCreateBranch, setShowCreateBranch] = useState(false);
  const [newBranch, setNewBranch] = useState('');
  const [changesCollapsed, setChangesCollapsed] = useState(false);
  const [stagedCollapsed, setStagedCollapsed] = useState(false);
  const [graphRefreshToken, setGraphRefreshToken] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const syncMenuRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(''), 2500);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const refresh = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    setError('');
    try {
      const res = await window.api.git.status();
      if (!res.success) {
        setError(res.error);
        setStatus(null);
        return;
      }
      setStatus(res.status);
      if (res.status.isRepo) {
        const br = await window.api.git.branches();
        if (br.success) setBranches(br.branches);
        setGraphRefreshToken(v => v + 1);
      } else {
        setBranches([]);
      }
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const unsub = window.api.files.onTreeChanged(() => { void refresh(); });
    return unsub;
  }, [refresh]);

  useEffect(() => {
    if (!menuOpen && !syncMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (syncMenuOpen && syncMenuRef.current && !syncMenuRef.current.contains(e.target as Node)) setSyncMenuOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [menuOpen, syncMenuOpen]);

  useEffect(() => {
    if (!selectedPath) {
      setDiffContent(null);
      setDiffError('');
      setDiffLoading(false);
      return;
    }
    let cancelled = false;
    setDiffLoading(true);
    setDiffError('');
    void (async () => {
      const res = await window.api.git.diffContent({ path: selectedPath, staged: selectedStaged });
      if (cancelled) return;
      setDiffLoading(false);
      if (res.success) setDiffContent(res.content);
      else {
        setDiffContent(null);
        setDiffError(res.error);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedPath, selectedStaged, status]);

  const run = async (label: string, fn: () => Promise<{ success: boolean; error?: string; output?: string; result?: { pull: string; push: string }; hash?: string }>) => {
    setBusy(label);
    setError('');
    setSyncMenuOpen(false);
    setMenuOpen(false);
    try {
      const res = await fn();
      if (!res.success) {
        setError(res.error || '操作失败');
        return;
      }
      showToast(SUCCESS_TOAST[label] || '操作成功');
      await refresh();
    } finally {
      setBusy('');
    }
  };

  const runPaths = async (fn: (paths: string[]) => Promise<{ success: boolean; error?: string }>, paths: string[]) => {
    const res = await fn(paths);
    if (!res.success) { setError(res.error || '操作失败'); return; }
    setError('');
    await refresh();
  };

  const handleCommit = async () => {
    if (!commitMessage.trim() || !status?.staged.length) return;
    await run('commit', () => window.api.git.commit(commitMessage.trim()).then(res => {
      if (res.success) setCommitMessage('');
      return res;
    }));
  };

  const handleCheckout = async (branch: string) => {
    if (!branch) return;
    await run('checkout', () => window.api.git.checkout({ branch }));
  };

  const handleCreateBranch = async () => {
    const name = newBranch.trim();
    if (!name) return;
    await run('branch', () => window.api.git.checkout({ branch: name, create: true }));
    setNewBranch('');
    setShowCreateBranch(false);
  };

  const openInEditor = (rel: string) => {
    if (!currentWorkspace) return;
    openFile(toAbsPath(currentWorkspace, rel), basename(rel));
  };

  const renderFileRow = (
    file: GitFileEntry,
    staged: boolean,
    opts: { hoverAction: string; onAction: (p: string) => void; secondary?: string; onSecondary?: (p: string) => void },
  ) => {
    const active = selectedPath === file.path && selectedStaged === staged;
    const icon = getFileIconInfo(basename(file.path));
    const st = displayStatus(file.status);
    return (
      <React.Fragment key={`${staged ? 's' : 'u'}-${file.path}`}>
        <div className={`${styles.fileRow} ${active ? styles.fileRowActive : ''}`}>
          <span className={styles.fileIcon} style={{ color: icon.color }}>{icon.text}</span>
          <span
            className={styles.fileName}
            title={file.path}
            onClick={() => { setSelectedPath(file.path); setSelectedStaged(staged); }}
            onDoubleClick={() => openInEditor(file.path)}
          >
            {basename(file.path)}
          </span>
          <div className={styles.fileEnd}>
            <button type="button" className={styles.hoverAction} title={opts.hoverAction} onClick={() => opts.onAction(file.path)}>
              {opts.hoverAction}
            </button>
            {opts.secondary && opts.onSecondary && (
              <button type="button" className={styles.hoverAction} title={opts.secondary} onClick={() => opts.onSecondary!(file.path)}>
                {opts.secondary}
              </button>
            )}
            <span className={styles.statusLetter} style={{ color: st.color }}>{st.letter}</span>
          </div>
        </div>
        {active && (
          <div className={styles.diffWrap}>
            {diffLoading && <div className={styles.diffPlaceholder}>加载 Diff…</div>}
            {!diffLoading && diffError && <div className={styles.diffPlaceholder}>{diffError}</div>}
            {!diffLoading && !diffError && diffContent && diffContent.original === diffContent.modified && (
              <div className={styles.diffPlaceholder}>无差异</div>
            )}
            {!diffLoading && !diffError && diffContent && diffContent.original !== diffContent.modified && (
              <DiffView
                original={diffContent.original}
                modified={diffContent.modified}
                language={getLanguage(basename(file.path))}
                originalLabel={diffContent.originalLabel}
                modifiedLabel={diffContent.modifiedLabel}
                height="220px"
                inline
              />
            )}
          </div>
        )}
      </React.Fragment>
    );
  };

  const changesCount = (status?.unstaged.length ?? 0) + (status?.untracked.length ?? 0);
  const disabled = !!busy || loading;
  const repoName = currentWorkspace?.split(/[/\\]/).pop() || 'workspace';

  if (!currentWorkspace) {
    return (
      <div className={styles.container}>
        <div className={styles.header}><span className={styles.headerTitle}>Source Control (Git)</span></div>
        <div className={styles.empty}>Open a workspace folder to manage Git.</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Source Control (Git)</span>
        <div className={styles.headerActions}>
          <button type="button" className={styles.iconBtn} title="Refresh" disabled={disabled} onClick={() => void refresh()}>↻</button>
          <div ref={menuRef} className={styles.menuAnchor}>
            <button type="button" className={styles.iconBtn} title="More Actions" disabled={disabled} onClick={() => setMenuOpen(v => !v)}>⋯</button>
            {menuOpen && (
              <div className={styles.menu}>
                <div className={styles.menuItem} onClick={() => void run('publish', () => window.api.git.publish())}>Publish Branch</div>
                <div className={styles.menuItem} onClick={() => void run('stash', () => window.api.git.stashPush())}>Stash Changes</div>
                <div className={styles.menuItem} onClick={() => void run('stash-pop', () => window.api.git.stashPop())}>Pop Stash</div>
                <div className={styles.menuItem} onClick={() => {
                  if (window.confirm('Discard all unstaged changes to tracked files?')) void run('discard-all', () => window.api.git.discardAll());
                }}>Discard All Changes</div>
                <div className={styles.menuItem} onClick={() => {
                  if (window.confirm('Delete all untracked files? This cannot be undone.')) void run('clean', () => window.api.git.cleanUntracked());
                }}>Clean Untracked Files</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {(busy || loading) && (
        <div className={styles.busy}>{busy ? getBusyText(busy) : '正在刷新状态…'}</div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {!status?.isRepo && (
        <div className={styles.empty}>
          No Git repository in <strong>{repoName}</strong>.
          <br />
          <button type="button" className={styles.initBtn} disabled={disabled} onClick={() => void run('init', () => window.api.git.init())}>
            Initialize Repository
          </button>
        </div>
      )}

      {status?.isRepo && (
        <>
          <div className={styles.block}>
            <div className={styles.blockLabel}>
              <span>Branches</span>
              {!showCreateBranch ? (
                <button type="button" className={styles.linkBtn} onClick={() => setShowCreateBranch(true)}>+ Create branch</button>
              ) : (
                <button type="button" className={styles.linkBtn} onClick={() => { setShowCreateBranch(false); setNewBranch(''); }}>✕</button>
              )}
            </div>
            <select
              className={styles.branchSelect}
              value={branches.find(b => b.current)?.name || status.branch}
              disabled={disabled}
              onChange={e => void handleCheckout(e.target.value)}
            >
              {branches.filter(b => !b.remote).map(b => (
                <option key={b.name} value={b.name}>{b.name}</option>
              ))}
              {branches.filter(b => b.remote).length > 0 && (
                <optgroup label="Remote">
                  {branches.filter(b => b.remote).map(b => (
                    <option key={b.name} value={b.name}>{b.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
            {showCreateBranch && (
              <div className={styles.createBranchRow}>
                <input
                  className={styles.createBranchInput}
                  placeholder="new-branch"
                  value={newBranch}
                  disabled={disabled}
                  onChange={e => setNewBranch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') void handleCreateBranch(); }}
                />
                <button type="button" className={styles.secondaryBtn} disabled={disabled || !newBranch.trim()} onClick={() => void handleCreateBranch()}>Create</button>
              </div>
            )}
            {!status.hasUpstream && !status.detached && (
              <div className={styles.publishLink}>
                <button type="button" className={styles.linkBtn} disabled={disabled} onClick={() => void run('publish', () => window.api.git.publish())}>
                  Publish Branch
                </button>
              </div>
            )}
          </div>

          <div className={styles.block}>
            <div className={styles.syncMenuWrap} ref={syncMenuRef}>
              <div className={styles.syncRow}>
                <button type="button" className={styles.syncPrimary} disabled={disabled} onClick={() => void run('sync', () => window.api.git.sync())}>
                  ⟳ Sync
                </button>
                <button type="button" className={styles.syncDrop} disabled={disabled} onClick={() => setSyncMenuOpen(v => !v)}>▾</button>
              </div>
              {syncMenuOpen && (
                <div className={styles.syncMenu}>
                  <div className={styles.menuItem} onClick={() => void run('sync', () => window.api.git.sync())}>Sync (Pull + Push)</div>
                  <div className={styles.menuItem} onClick={() => void run('pull', () => window.api.git.pull())}>Pull</div>
                  <div className={styles.menuItem} onClick={() => void run('push', () => window.api.git.push())}>Push</div>
                  <div className={styles.menuItem} onClick={() => void run('fetch', () => window.api.git.fetch())}>Fetch</div>
                </div>
              )}
            </div>
            <div className={styles.secondaryActions}>
              <button type="button" className={styles.secondaryBtn} disabled={disabled} onClick={() => void run('pull', () => window.api.git.pull())}>Pull</button>
              <button type="button" className={styles.secondaryBtn} disabled={disabled} onClick={() => void run('fetch', () => window.api.git.fetch())}>Fetch</button>
              <button type="button" className={styles.secondaryBtn} disabled={disabled} onClick={() => void run('rebase', () => window.api.git.pullRebase())}>Rebase</button>
            </div>
            <div className={styles.aheadBehind}>
              Ahead/Behind:
              {status.ahead > 0 && <span className={styles.ahead}>{status.ahead}↑</span>}
              {status.behind > 0 && <span className={styles.behind}>{status.behind}↓</span>}
              {status.ahead === 0 && status.behind === 0 && <span> —</span>}
            </div>
          </div>

          <div className={styles.block}>
            <textarea
              className={styles.commitInput}
              placeholder="Commit Message (Ctrl+Enter to commit)"
              value={commitMessage}
              disabled={disabled}
              onChange={e => setCommitMessage(e.target.value)}
              onKeyDown={e => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  void handleCommit();
                }
              }}
            />
            <div className={styles.commitPushRow}>
              <button
                type="button"
                className={styles.commitBtn}
                disabled={disabled || !commitMessage.trim() || status.staged.length === 0}
                onClick={() => void handleCommit()}
              >
                ✓ Commit
              </button>
              <button
                type="button"
                className={styles.pushBtn}
                disabled={disabled}
                onClick={() => void run('push', () => window.api.git.push())}
              >
                ↑ Push
              </button>
            </div>
          </div>

          <div className={styles.body}>
            {status.conflicts.length > 0 && (
              <CollapsibleSection title="Merge Conflicts" count={status.conflicts.length} collapsed={false} onToggle={() => {}}>
                {status.conflicts.map(file => renderFileRow(file, false, {
                  hoverAction: '↗',
                  onAction: (p) => openInEditor(p),
                }))}
              </CollapsibleSection>
            )}

            <CollapsibleSection
              title="Changes"
              count={changesCount}
              collapsed={changesCollapsed}
              onToggle={() => setChangesCollapsed(v => !v)}
              tools={changesCount > 0 ? (
                <button type="button" className={styles.toolIconBtn} title="Stage All" disabled={disabled} onClick={() => void run('stage-all', () => window.api.git.stageAll())}>+</button>
              ) : undefined}
            >
              {[...status.unstaged, ...status.untracked].map(file => renderFileRow(file, false, {
                hoverAction: '+',
                onAction: (p) => void runPaths(window.api.git.stage, [p]),
                secondary: '↶',
                onSecondary: (p) => void runPaths(window.api.git.discard, [p]),
              }))}
              {changesCount === 0 && <div className={styles.empty}>No changes</div>}
            </CollapsibleSection>

            <CollapsibleSection
              title="Staged Changes"
              count={status.staged.length}
              collapsed={stagedCollapsed}
              onToggle={() => setStagedCollapsed(v => !v)}
              tools={status.staged.length > 0 ? (
                <button type="button" className={styles.toolIconBtn} title="Unstage All" disabled={disabled} onClick={() => void run('unstage-all', () => window.api.git.unstageAll())}>−</button>
              ) : undefined}
            >
              {status.staged.map(file => renderFileRow(file, true, {
                hoverAction: '−',
                onAction: (p) => void runPaths(window.api.git.unstage, [p]),
              }))}
              {status.staged.length === 0 && <div className={styles.empty}>No staged changes</div>}
            </CollapsibleSection>
          </div>

          <GitGraph
            refreshToken={graphRefreshToken}
            disabled={disabled}
            onPull={() => void run('pull', () => window.api.git.pull())}
            onPush={() => void run('push', () => window.api.git.push())}
            onFetch={() => void run('fetch', () => window.api.git.fetch())}
          />
        </>
      )}

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
}
