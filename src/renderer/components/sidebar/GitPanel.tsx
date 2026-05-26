import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFilesStore } from '../../stores/files';
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

function statusColor(status: string): string {
  if (status === '?') return '#60a5fa';
  if (status === 'D' || status.includes('U')) return '#ef4444';
  if (status === 'A') return '#22c55e';
  return '#ffb74d';
}

function basename(p: string): string {
  return p.split(/[/\\]/).pop() || p;
}

function toAbsPath(workspace: string, rel: string): string {
  const sep = workspace.includes('\\') ? '\\' : '/';
  return `${workspace}${sep}${rel.split('/').join(sep)}`;
}

export default function GitPanel() {
  const { currentWorkspace, openFile } = useFilesStore();
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [branches, setBranches] = useState<GitBranchInfo[]>([]);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedStaged, setSelectedStaged] = useState(false);
  const [diff, setDiff] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [newBranch, setNewBranch] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

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
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!selectedPath) { setDiff(''); return; }
    void (async () => {
      const res = await window.api.git.diff({ path: selectedPath, staged: selectedStaged });
      setDiff(res.success ? res.diff : res.error);
    })();
  }, [selectedPath, selectedStaged]);

  const run = async (label: string, fn: () => Promise<{ success: boolean; error?: string; output?: string; result?: { pull: string; push: string }; hash?: string }>) => {
    setBusy(label);
    setError('');
    setInfo('');
    try {
      const res = await fn();
      if (!res.success) {
        setError(res.error || '操作失败');
        return;
      }
      if (res.output) setInfo(res.output);
      if (res.hash) setInfo(`提交成功 ${res.hash}`);
      if (res.result) setInfo(`同步完成\nPull: ${res.result.pull}\nPush: ${res.result.push}`);
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

  const handleCommit = async (andPush = false, andSync = false) => {
    if (!commitMessage.trim()) return;
    await run('commit', async () => {
      const res = await window.api.git.commit(commitMessage.trim());
      if (!res.success) return res;
      setCommitMessage('');
      if (andSync) {
        const sync = await window.api.git.sync();
        if (!sync.success) return sync;
        return { success: true as const, hash: res.hash, result: sync.result };
      }
      if (andPush) {
        const push = await window.api.git.push();
        if (!push.success) return push;
        return { success: true as const, hash: res.hash, output: push.output };
      }
      return res;
    });
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
  };

  const openInEditor = (rel: string) => {
    if (!currentWorkspace) return;
    const abs = toAbsPath(currentWorkspace, rel);
    openFile(abs, basename(rel));
  };

  const renderFiles = (
    files: GitFileEntry[],
    staged: boolean,
    opts: { primary: string; onPrimary: (p: string) => void; secondary?: string; onSecondary?: (p: string) => void; conflict?: boolean },
  ) => files.map(file => {
    const active = selectedPath === file.path && selectedStaged === staged;
    return (
      <React.Fragment key={`${staged ? 's' : 'u'}-${file.path}`}>
        <div className={`${styles.fileRow} ${active ? styles.fileRowActive : ''} ${opts.conflict ? styles.conflictRow : ''}`}>
          <span className={styles.statusTag} style={{ color: statusColor(file.status) }}>{file.status}</span>
          <span
            className={styles.filePath}
            title={file.path}
            onClick={() => { setSelectedPath(file.path); setSelectedStaged(staged); }}
            onDoubleClick={() => openInEditor(file.path)}
          >
            {file.path}
          </span>
          <div className={styles.rowActions}>
            <button type="button" className={styles.rowBtn} title={opts.primary} onClick={() => opts.onPrimary(file.path)}>{opts.primary}</button>
            {opts.secondary && opts.onSecondary && (
              <button type="button" className={styles.rowBtn} title={opts.secondary} onClick={() => opts.onSecondary!(file.path)}>{opts.secondary}</button>
            )}
          </div>
        </div>
        {active && diff && <pre className={styles.diff}>{diff}</pre>}
      </React.Fragment>
    );
  });

  const changesCount = (status?.unstaged.length ?? 0) + (status?.untracked.length ?? 0);
  const disabled = !!busy || loading;

  if (!currentWorkspace) {
    return (
      <div className={styles.container}>
        <div className={styles.header}><span className={styles.headerTitle}>源代码管理</span></div>
        <div className={styles.empty}>请先打开工作区文件夹</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>源代码管理</span>
        <div className={styles.toolbar}>
          <button type="button" className={styles.toolBtn} title="刷新" disabled={disabled} onClick={() => void refresh()}>↻</button>
          <button type="button" className={styles.toolBtn} title="拉取" disabled={disabled || !status?.isRepo} onClick={() => void run('pull', () => window.api.git.pull())}>↓</button>
          <button type="button" className={styles.toolBtn} title="推送" disabled={disabled || !status?.isRepo} onClick={() => void run('push', () => window.api.git.push())}>↑</button>
          <button type="button" className={styles.toolBtn} title="同步 (Pull + Push)" disabled={disabled || !status?.isRepo} onClick={() => void run('sync', () => window.api.git.sync())}>⟳</button>
          <div ref={menuRef} className={styles.menuAnchor}>
            <button type="button" className={styles.toolBtn} title="更多操作" disabled={disabled} onClick={() => setMenuOpen(v => !v)}>⋯</button>
            {menuOpen && (
              <div className={styles.menu}>
                <div className={styles.menuItem} onClick={() => { setMenuOpen(false); void run('fetch', () => window.api.git.fetch()); }}>Fetch</div>
                <div className={styles.menuItem} onClick={() => { setMenuOpen(false); void run('stash', () => window.api.git.stashPush()); }}>Stash 更改</div>
                <div className={styles.menuItem} onClick={() => { setMenuOpen(false); void run('stash-pop', () => window.api.git.stashPop()); }}>Pop Stash</div>
                <div className={styles.menuItem} onClick={() => {
                  setMenuOpen(false);
                  if (window.confirm('确定丢弃所有未暂存的 tracked 文件更改？')) void run('discard-all', () => window.api.git.discardAll());
                }}>丢弃全部更改</div>
                <div className={styles.menuItem} onClick={() => {
                  setMenuOpen(false);
                  if (window.confirm('确定删除所有未跟踪文件？此操作不可撤销。')) void run('clean', () => window.api.git.cleanUntracked());
                }}>清理未跟踪文件</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {info && <div className={styles.info}>{info}</div>}

      {!status?.isRepo && (
        <div className={styles.empty}>
          当前工作区尚未初始化 Git 仓库。
          <br />
          <button type="button" className={styles.initBtn} disabled={disabled} onClick={() => void run('init', () => window.api.git.init())}>
            初始化仓库
          </button>
        </div>
      )}

      {status?.isRepo && (
        <>
          <div className={styles.branchRow}>
            <select
              className={styles.branchSelect}
              value={branches.find(b => b.current)?.name || status.branch}
              disabled={disabled}
              onChange={e => void handleCheckout(e.target.value)}
            >
              {branches.filter(b => !b.remote).map(b => (
                <option key={b.name} value={b.name}>{b.name}{b.current ? ' ✓' : ''}</option>
              ))}
              {branches.filter(b => b.remote).length > 0 && (
                <optgroup label="远程">
                  {branches.filter(b => b.remote).map(b => (
                    <option key={b.name} value={b.name}>{b.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
            {(status.ahead > 0 || status.behind > 0) && (
              <span className={styles.syncBadge}>
                {status.ahead > 0 ? `↑${status.ahead}` : ''}{status.behind > 0 ? ` ↓${status.behind}` : ''}
              </span>
            )}
            {!status.hasUpstream && !status.detached && (
              <button type="button" className={styles.publishBtn} disabled={disabled} onClick={() => void run('publish', () => window.api.git.publish())}>
                发布 Branch
              </button>
            )}
          </div>

          <div className={styles.branchRow} style={{ borderBottom: 'none', paddingTop: 0 }}>
            <input
              className={styles.branchSelect}
              placeholder="新建分支名"
              value={newBranch}
              disabled={disabled}
              onChange={e => setNewBranch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleCreateBranch(); }}
            />
            <button type="button" className={styles.publishBtn} disabled={disabled || !newBranch.trim()} onClick={() => void handleCreateBranch()}>
              创建
            </button>
          </div>

          <div className={styles.commitBox}>
            <textarea
              className={styles.commitInput}
              placeholder="消息（Enter 提交时在上方输入）"
              value={commitMessage}
              disabled={disabled}
              onChange={e => setCommitMessage(e.target.value)}
            />
            <div className={styles.commitActions}>
              <button
                type="button"
                className={styles.commitBtn}
                disabled={disabled || !commitMessage.trim() || status.staged.length === 0}
                onClick={() => void handleCommit()}
              >
                ✓ 提交
              </button>
              <button
                type="button"
                className={`${styles.commitBtn} ${styles.commitBtnSecondary}`}
                disabled={disabled || !commitMessage.trim() || status.staged.length === 0}
                onClick={() => void handleCommit(true)}
              >
                提交并推送
              </button>
              <button
                type="button"
                className={`${styles.commitBtn} ${styles.commitBtnSecondary}`}
                disabled={disabled || !commitMessage.trim() || status.staged.length === 0}
                onClick={() => void handleCommit(false, true)}
              >
                提交并同步
              </button>
            </div>
          </div>

          <div className={styles.body}>
            {status.conflicts.length > 0 && (
              <>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>合并冲突 ({status.conflicts.length})</span>
                </div>
                {renderFiles(status.conflicts, false, {
                  primary: '打开',
                  onPrimary: (p) => openInEditor(p),
                  conflict: true,
                })}
              </>
            )}

            {status.staged.length > 0 && (
              <>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>暂存的更改 ({status.staged.length})</span>
                  <button type="button" className={styles.sectionAction} disabled={disabled} onClick={() => void run('unstage-all', () => window.api.git.unstageAll())}>
                    全部取消暂存
                  </button>
                </div>
                {renderFiles(status.staged, true, {
                  primary: '−',
                  onPrimary: (p) => void runPaths(window.api.git.unstage, [p]),
                })}
              </>
            )}

            {(changesCount > 0 || status.staged.length === 0) && (
              <>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>更改 ({changesCount})</span>
                  {changesCount > 0 && (
                    <button type="button" className={styles.sectionAction} disabled={disabled} onClick={() => void run('stage-all', () => window.api.git.stageAll())}>
                      全部暂存
                    </button>
                  )}
                </div>
                {renderFiles(status.unstaged, false, {
                  primary: '+',
                  onPrimary: (p) => void runPaths(window.api.git.stage, [p]),
                  secondary: '↶',
                  onSecondary: (p) => void runPaths(window.api.git.discard, [p]),
                })}
                {renderFiles(status.untracked, false, {
                  primary: '+',
                  onPrimary: (p) => void runPaths(window.api.git.stage, [p]),
                })}
                {changesCount === 0 && status.staged.length === 0 && status.clean && (
                  <div className={styles.empty}>没有更改</div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
