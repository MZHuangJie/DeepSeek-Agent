import React from 'react';
import { useAgentStore, SubAgentStatus } from '../../stores/agent';

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
    return <img src="/assets/8.png" alt="running" style={{ width: 12, height: 12 }} />;
  }
  if (status === 'completed') {
    return <img src="/assets/6.png" alt="ok" style={{ width: 12, height: 12 }} />;
  }
  return <img src="/assets/12.png" alt="failed" style={{ width: 12, height: 12 }} />;
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
    <div style={{
      fontSize: 11,
      padding: '6px 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>{statusIcon(sa.status)}</span>
        <span style={{
          color, fontWeight: 600, fontSize: 10,
          padding: '1px 6px', borderRadius: 3,
          background: `${color}22`,
        }}>{label}</span>
        <span style={{
          color: 'var(--text-primary)',
          fontSize: 11,
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>{sa.targetPath || '—'}</span>
        <span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>
          {formatDuration(sa.startTime, sa.endTime)}
        </span>
      </div>
      <div style={{
        display: 'flex',
        gap: 10,
        marginTop: 3,
        paddingLeft: 18,
        color: 'var(--text-secondary)',
        fontSize: 10,
      }}>
        <span>📄 {sa.filesProcessed}</span>
        <span>🔢 {sa.tokenUsage.total.toLocaleString()} tk</span>
        {isRunning && <span style={{ color }}>运行中…</span>}
      </div>
      {sa.error && (
        <div style={{
          marginTop: 3,
          paddingLeft: 18,
          color: '#ff6b6b',
          fontSize: 10,
          wordBreak: 'break-word',
        }}>{sa.error}</div>
      )}
      {sa.summary && (
        <div style={{
          marginTop: 3,
          paddingLeft: 18,
          color: 'var(--text-secondary)',
          fontSize: 10,
          opacity: 0.8,
          maxHeight: 40,
          overflow: 'hidden',
        }}>{sa.summary.slice(0, 140)}{sa.summary.length > 140 ? '…' : ''}</div>
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
    <div style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
      <div style={{
        fontSize: 11,
        color: 'var(--text-secondary)',
        marginBottom: 6,
        textTransform: 'uppercase',
        fontWeight: 600,
        letterSpacing: 0.5,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <span>子代理</span>
        {subAgents.length > 0 && (
          <span style={{
            fontSize: 10,
            opacity: 0.7,
            textTransform: 'none',
            letterSpacing: 0,
          }}>
            {running > 0 && <span style={{ color: '#4fc3f7' }}>● {running} 运行中</span>}
            {running > 0 && (completed > 0 || failed > 0) && ' · '}
            {completed > 0 && <span style={{ color: '#81c784' }}>✓ {completed}</span>}
            {completed > 0 && failed > 0 && ' · '}
            {failed > 0 && <span style={{ color: '#ff6b6b' }}>✗ {failed}</span>}
          </span>
        )}
      </div>
      {subAgents.length === 0 ? (
        <div style={{
          fontSize: 11,
          color: 'var(--text-secondary)',
          opacity: 0.5,
          padding: '4px 0',
          fontStyle: 'italic',
        }}>
          暂未派出子代理（大型项目探索时模型会自动启用）
        </div>
      ) : (
        <div style={{ maxHeight: 240, overflow: 'auto' }}>
          {subAgents.map(sa => <SubAgentRow key={sa.id} sa={sa} />)}
        </div>
      )}
    </div>
  );
}
