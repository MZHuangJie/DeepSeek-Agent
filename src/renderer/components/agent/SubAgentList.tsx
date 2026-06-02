import React from 'react';
import { useAgentStore, SubAgentStatus } from '../../stores/agent';
import styles from './SubAgentList.module.css';

const TYPE_LABELS: Record<SubAgentStatus['type'], string> = {
  explore: '探索',
  analyze: '分析',
  implement: '实现',
  review: '审查',
};

const TYPE_COLORS: Record<SubAgentStatus['type'], string> = {
  explore: '#4fc3f7',
  analyze: '#ffb74d',
  implement: '#81c784',
  review: '#ba68c8',
};

function statusIcon(status: SubAgentStatus['status']) {
  if (status === 'spawning' || status === 'running') {
    return <img src="./assets/8.png" alt="running" className={styles.iconImg} />;
  }
  if (status === 'completed') {
    return <img src="./assets/6.png" alt="ok" className={styles.iconImg} />;
  }
  return <img src="./assets/12.png" alt="failed" className={styles.iconImg} />;
}

function formatDuration(start: number, end?: number): string {
  const ms = (end ?? Date.now()) - start;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m${Math.floor((ms % 60_000) / 1000)}s`;
}

function SubAgentRow({ sa }: { sa: SubAgentStatus }) {
  const color = TYPE_COLORS[sa.type];
  const label = TYPE_LABELS[sa.type];
  const isRunning = sa.status === 'running' || sa.status === 'spawning';

  return (
    <div className={styles.row}>
      <div className={styles.rowTop}>
        <span>{statusIcon(sa.status)}</span>
        <span className={styles.typeBadge} style={{ color, background: `${color}22` }}>{label}</span>
        <span className={styles.target}>{sa.targetPath || '—'}</span>
        <span className={styles.duration}>{formatDuration(sa.startTime, sa.endTime)}</span>
      </div>
      <div className={styles.rowMeta}>
        <span>📄 {sa.filesProcessed}</span>
        <span>🔢 {sa.tokenUsage.total.toLocaleString()} tk</span>
        {isRunning && <span className={styles.runningTag} style={{ color }}>运行中…</span>}
      </div>
      {sa.error && (
        <div className={styles.error}>{sa.error}</div>
      )}
      {sa.summary && (
        <div className={styles.summary}>{sa.summary.slice(0, 140)}{sa.summary.length > 140 ? '…' : ''}</div>
      )}
    </div>
  );
}

export default function SubAgentList() {
  const { subAgents } = useAgentStore();

  const running = subAgents.filter(s => s.status === 'running' || s.status === 'spawning').length;
  const completed = subAgents.filter(s => s.status === 'completed').length;
  const failed = subAgents.filter(s => s.status === 'failed').length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span>子代理</span>
        {subAgents.length > 0 && (
          <span className={styles.stats}>
            {running > 0 && <span className={styles.statRunning}>● {running} 运行中</span>}
            {running > 0 && (completed > 0 || failed > 0) && ' · '}
            {completed > 0 && <span className={styles.statCompleted}>✓ {completed}</span>}
            {completed > 0 && failed > 0 && ' · '}
            {failed > 0 && <span className={styles.statFailed}>✗ {failed}</span>}
          </span>
        )}
      </div>
      {subAgents.length === 0 ? (
        <div className={styles.empty}>暂未派出子代理（大型项目探索时模型会自动启用）</div>
      ) : (
        <div className={styles.list}>
          {subAgents.map(sa => <SubAgentRow key={sa.id} sa={sa} />)}
        </div>
      )}
    </div>
  );
}
