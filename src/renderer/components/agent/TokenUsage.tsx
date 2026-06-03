import React from 'react';
import { useAgentStore } from '../../stores/agent';
import styles from './TokenUsage.module.css';

function fmtTokens(n: number): string {
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n.toString();
}

export default function TokenUsage() {
  const { tokenStats } = useAgentStore();

  if (!tokenStats) {
    return (
      <div className={styles.container}>
        <span className={styles.header}>Token 用量</span>
        <div className={styles.emptyRow}>暂无数据</div>
      </div>
    );
  }

  const stats = tokenStats;
  const pct = (x: number): string => stats.total > 0 ? ((x / stats.total) * 100).toFixed(1) : '0';
  const ctxPct = stats.contextMax > 0 ? (stats.contextWindow / stats.contextMax) * 100 : 0;

  return (
    <div className={styles.container}>
      <span className={styles.header}>Token 用量</span>

      {/* 总 Token 数 + 费用 */}
      <div className={styles.totalRow}>
        <span className={styles.totalValue}>{fmtTokens(stats.total)}</span>
        <span className={styles.totalLabel}>total tokens</span>
        {stats.cost > 0 && (
          <span className={styles.costBadge}>≈ ¥ {stats.cost.toFixed(4)}</span>
        )}
      </div>

      {/* 主 Agent / 子代理 拆分 */}
      {(stats.mainTotal !== undefined || stats.subAgentTotal !== undefined) && (
        <div className={styles.splitRow}>
          <div className={styles.splitItem}>
            <span className={styles.splitVal}>{fmtTokens(stats.mainTotal ?? 0)}</span>
            <span className={styles.splitLabel}>主 Agent</span>
          </div>
          <div className={styles.splitDivider} />
          <div className={styles.splitItem}>
            <span className={styles.splitVal}>{fmtTokens(stats.subAgentTotal ?? 0)}</span>
            <span className={styles.splitLabel}>子代理</span>
          </div>
        </div>
      )}

      {/* 缓存命中率 */}
      {stats.promptCacheHit !== undefined && stats.promptCacheMiss !== undefined && (stats.promptCacheHit + stats.promptCacheMiss) > 0 && (
        <div className={styles.cacheSection}>
          <div className={styles.cacheRow}>
            <span className={styles.cacheLabel}>缓存命中率</span>
            <span className={styles.cachePct}>
              {((stats.promptCacheHit / (stats.promptCacheHit + stats.promptCacheMiss)) * 100).toFixed(0)}%
            </span>
          </div>
          <div className={styles.cacheBar}>
            <div
              className={styles.cacheHit}
              style={{ flex: stats.promptCacheHit }}
              title={`命中 ${fmtTokens(stats.promptCacheHit)}`}
            />
            <div
              className={styles.cacheMiss}
              style={{ flex: stats.promptCacheMiss }}
              title={`未命中 ${fmtTokens(stats.promptCacheMiss)}`}
            />
          </div>
          <div className={styles.cacheLegend}>
            <span>命中 {fmtTokens(stats.promptCacheHit)}</span>
            <span>未命中 {fmtTokens(stats.promptCacheMiss)}</span>
          </div>
        </div>
      )}

      {/* 各类 token 消耗条 */}
      <div className={styles.barsSection}>
        <div className={styles.barRow}>
          <span className={styles.barLabel}>提示词</span>
          <div className={styles.barTrack}>
            <div className={styles.barFill} style={{ width: `${pct(stats.prompt)}%`, background: '#6366f1' }} />
          </div>
          <span className={styles.barVal}>{fmtTokens(stats.prompt)} ({pct(stats.prompt)}%)</span>
        </div>

        <div className={styles.barRow}>
          <span className={styles.barLabel}>回复</span>
          <div className={styles.barTrack}>
            <div className={styles.barFill} style={{ width: `${pct(stats.completion)}%`, background: '#22c55e' }} />
          </div>
          <span className={styles.barVal}>{fmtTokens(stats.completion)} ({pct(stats.completion)}%)</span>
        </div>

        {(stats.toolTokens ?? 0) > 0 && (
          <div className={styles.barRow}>
            <span className={styles.barLabel}>工具</span>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ width: `${pct(stats.toolTokens!)}%`, background: '#f59e0b' }} />
            </div>
            <span className={styles.barVal}>{fmtTokens(stats.toolTokens!)} ({pct(stats.toolTokens!)}%)</span>
          </div>
        )}
      </div>

      {/* 上下文窗口用量条 */}
      <div className={styles.ctxSection}>
        <div className={styles.ctxLabels}>
          <span className={styles.ctxLabel}>上下文窗口</span>
          <span className={styles.ctxVal}>{fmtTokens(stats.contextWindow)} / {fmtTokens(stats.contextMax)}</span>
        </div>
        <div className={styles.ctxBar}>
          <div
            className={styles.ctxFill}
            style={{
              width: `${Math.min(ctxPct, 100)}%`,
              background: ctxPct >= 90 ? '#ef4444' : ctxPct >= 70 ? '#f59e0b' : 'var(--accent)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
