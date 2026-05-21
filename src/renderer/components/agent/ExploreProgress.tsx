import React from 'react';
import { useAgentStore } from '../../stores/agent';

export default function ExploreProgress() {
  const { exploreProgress } = useAgentStore();
  if (!exploreProgress) return null;

  const { readPercentage, readFileCount, totalFiles, step, total, warning } = exploreProgress;

  return (
    <div style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>
        探索进度
      </div>

      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div style={{ flex: 1, background: 'var(--bg-tertiary)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
          <div style={{
            width: `${Math.min(readPercentage, 100)}%`,
            height: '100%',
            background: readPercentage >= 80 ? '#22c55e' : 'var(--accent)',
            borderRadius: 4,
            transition: 'width 0.3s',
          }} />
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          {readPercentage}%
        </span>
      </div>

      {/* Stats */}
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
        {readFileCount} / {totalFiles} 个文件 · 第 {step}/{total} 轮
      </div>

      {warning && (
        <div style={{ fontSize: 11, color: '#ffb74d', marginTop: 4, padding: '4px 8px', background: 'rgba(255,183,77,0.1)', borderRadius: 4 }}>
          ⚠️ {warning}
        </div>
      )}
    </div>
  );
}
