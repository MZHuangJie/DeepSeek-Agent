import React from 'react';
import { useAgentStore } from '../../stores/agent';
import styles from './ExploreProgress.module.css';

export default function ExploreProgress() {
  const { exploreProgress } = useAgentStore();
  if (!exploreProgress) return null;

  const { readPercentage, readFileCount, totalFiles, step, total, warning } = exploreProgress;

  return (
    <div className={styles.container}>
      <div className={styles.header}>探索进度</div>

      <div className={styles.progressRow}>
        <div className={styles.bar}>
          <div className={styles.barFill} style={{
            width: `${Math.min(readPercentage, 100)}%`,
            background: readPercentage >= 80 ? '#22c55e' : 'var(--accent)',
          }} />
        </div>
        <span className={styles.pct}>{readPercentage}%</span>
      </div>

      <div className={styles.stats}>
        {readFileCount} / {totalFiles} 个文件 · 第 {step}/{total} 轮
      </div>

      {warning && (
        <div className={styles.warning}>⚠️ {warning}</div>
      )}
    </div>
  );
}
