import React, { useCallback, useEffect, useState } from 'react';
import { useFilesStore } from '../../stores/files';
import styles from './GitPanel.module.css';

interface GitFileEntry {
  path: string;
  status: string;
}

interface GitStatus {
  isRepo: boolean;
  branch: string;
  upstream?: string;
  ahead: number;
  behind: number;
  staged: GitFileEntry[];
  unstaged: GitFileEntry[];
  untracked: GitFileEntry[];
  clean: boolean;
}

interface GitLogEntry {
  hash: string;
  message: string;
}

function statusColor(status: string): string {
  if (status === '?') return '#60a5fa';
  if (status === 'D') return '#ef4444';
  if (status === 'A') return '#22c55e';
  return '#ffb74d';
}

export default function GitPanel() {
  const { currentWorkspace } = useFilesStore();
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [logs, setLogs] = useState<GitLogEntry[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedStaged, setSelectedStaged] = useState(false);
  const [diff, setDiff] = useState('');

  const refresh = useCallback(async () => {
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
        const logRes = await window.api.git.log(8);
        if (logRes.success) setLogs(logRes.entries);
      } else {
        setLogs([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [currentWorkspace, refresh]);

  useEffect(() => {
    const unsub = window.api.files.onTreeChanged(() => { void refresh(); });
    return unsub;
  }, [refresh]);

  useEffect(() => {
    if (!selectedPath) {
      setDiff('');
      return;
    }
    void (async () => {
      const res = await window.api.git.diff({ path: selectedPath, staged: selectedStaged });
      setDiff(res.success ? res.diff : res.error);
    })();
  }, [selectedPath, selectedStaged]);

  const runGitPaths = async (fn: (paths: string[]) => Promise<{ success: boolean; error?: string }>, paths: string[]) => {
    const res = await fn(paths);
    if (!res.success) {
      setError(res.error || '操作失败');
      return;
    }
    setError('');
    await refresh();
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    const res = await window.api.git.commit(commitMessage.trim());
    if (!res.success) {
      setError(res.error);
      return;
    }
    setCommitMessage('');
    setError('');
    await refresh();
  };

  const renderFileSection = (
    title: string,
    files: GitFileEntry[],
    staged: boolean,
    actions: { primary: string; onPrimary: (path: string) => void; secondary?: string; onSecondary?: (path: string) => void },
  ) => {
    if (files.length === 0) return null;
    return (
      <>
        <div className={styles.sectionTitle}>{title} ({files.length})</div>
        {files.map(file => {
          const active = selectedPath === file.path && selectedStaged === staged;
          return (
            <React.Fragment key={`${staged ? 's' : 'u'}-${file.path}`}>
              <div className={`${styles.fileRow} ${active ? styles.fileRowActive : ''}`}>
                <span className={styles.statusTag} style={{ color: statusColor(file.status) }}>{file.status}</span>
                <span
                  className={styles.filePath}
                  title={file.path}
                  onClick={() => {
                    setSelectedPath(file.path);
                    setSelectedStaged(staged);
                  }}
                >
                  {file.path}
                </span>
                <div className={styles.rowActions}>
                  <button type="button" className={styles.rowBtn} onClick={() => actions.onPrimary(file.path)}>
                    {actions.primary}
                  </button>
                  {actions.secondary && actions.onSecondary && (
                    <button type="button" className={styles.rowBtn} onClick={() => actions.onSecondary!(file.path)}>
                      {actions.secondary}
                    </button>
                  )}
                </div>
              </div>
              {active && diff && <pre className={styles.diff}>{diff}</pre>}
            </React.Fragment>
          );
        })}
      </>
    );
  };

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
        <div className={styles.headerActions}>
          <button type="button" className={styles.iconBtn} onClick={() => void refresh()} disabled={loading}>
            {loading ? '…' : '刷新'}
          </button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {!status?.isRepo && (
        <div className={styles.empty}>
          当前工作区不是 Git 仓库。<br />
          可在终端运行 git init 初始化。
        </div>
      )}

      {status?.isRepo && (
        <>
          <div className={styles.meta}>
            <div><span className={styles.branch}>{status.branch}</span>{status.upstream ? ` → ${status.upstream}` : ''}</div>
            {(status.ahead > 0 || status.behind > 0) && (
              <div>
                {status.ahead > 0 ? `领先 ${status.ahead}` : ''}
                {status.ahead > 0 && status.behind > 0 ? ' · ' : ''}
                {status.behind > 0 ? `落后 ${status.behind}` : ''}
              </div>
            )}
            {status.clean && <div>工作区干净</div>}
          </div>

          <div className={styles.body}>
            {renderFileSection('已暂存', status.staged, true, {
              primary: '取消',
              onPrimary: (path) => void runGitPaths(window.api.git.unstage, [path]),
            })}
            {renderFileSection('更改', status.unstaged, false, {
              primary: '+',
              onPrimary: (path) => void runGitPaths(window.api.git.stage, [path]),
              secondary: '还原',
              onSecondary: (path) => void runGitPaths(window.api.git.discard, [path]),
            })}
            {renderFileSection('未跟踪', status.untracked, false, {
              primary: '+',
              onPrimary: (path) => void runGitPaths(window.api.git.stage, [path]),
            })}

            {logs.length > 0 && (
              <>
                <div className={styles.sectionTitle}>最近提交</div>
                {logs.map(entry => (
                  <div key={entry.hash} className={styles.logRow}>
                    <span className={styles.logHash}>{entry.hash}</span>
                    {entry.message}
                  </div>
                ))}
              </>
            )}
          </div>

          <div className={styles.footer}>
            <textarea
              className={styles.commitInput}
              placeholder="提交说明"
              value={commitMessage}
              onChange={e => setCommitMessage(e.target.value)}
            />
            <button
              type="button"
              className={styles.commitBtn}
              disabled={!commitMessage.trim() || status.staged.length === 0}
              onClick={() => void handleCommit()}
            >
              提交 ({status.staged.length})
            </button>
          </div>
        </>
      )}
    </div>
  );
}
