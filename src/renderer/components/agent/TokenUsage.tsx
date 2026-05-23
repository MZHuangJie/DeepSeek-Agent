import React from 'react';
import { useAgentStore } from '../../stores/agent';
import styles from './TokenUsage.module.css';

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return n.toString();
}

export default function TokenUsage() {
  const { tokenStats } = useAgentStore();
  const s = tokenStats ?? { total: 0, prompt: 0, completion: 0, toolTokens: 0, contextWindow: 0, contextMax: 100000, cost: 0 };

  const promptPct = s.total > 0 ? (s.prompt / s.total * 100).toFixed(1) : '0.0';
  const completionPct = s.total > 0 ? (s.completion / s.total * 100).toFixed(1) : '0.0';
  const toolPct = s.total > 0 ? (s.toolTokens ?? 0) / s.total * 100 : 0;
  const ctxPct = s.contextMax > 0 ? (s.contextWindow / s.contextMax * 100).toFixed(1) : '0.0';

  return (
    <div className={styles.container}>
      <div className={styles.header}>Token 用量</div>
      <div className={styles.total}>{fmt(s.total)}</div>

      <div className={styles.row}>
        <span className={styles.rowLabel}>提示词 Tokens</span>
        <span>{fmt(s.prompt)} ({promptPct}%)</span>
      </div>
      <div className={styles.bar}>
        <div className={styles.barFill} style={{ width: `${s.total > 0 ? promptPct : 0}%`, background: '#6366f1' }} />
      </div>

      <div className={styles.row}>
        <span className={styles.rowLabel}>回复 Tokens</span>
        <span>{fmt(s.completion)} ({completionPct}%)</span>
      </div>
      <div className={styles.bar}>
        <div className={styles.barFill} style={{ width: `${s.total > 0 ? completionPct : 0}%`, background: '#22c55e' }} />
      </div>

      <div className={styles.row}>
        <span className={styles.rowLabel}>工具 Tokens</span>
        <span>{fmt(s.toolTokens ?? 0)} ({toolPct.toFixed(1)}%)</span>
      </div>
      <div className={styles.bar}>
        <div className={styles.barFill} style={{ width: `${Math.min(toolPct, 100)}%`, background: '#f59e0b' }} />
      </div>

      <div className={styles.row}>
        <span className={styles.rowLabel}>上下文窗口</span>
        <span>{fmt(s.contextWindow)} / {fmt(s.contextMax)}</span>
      </div>
      <div className={styles.bar}>
        <div className={styles.barFill} style={{ width: `${ctxPct}%`, background: 'var(--accent)' }} />
      </div>
    </div>
  );
}
