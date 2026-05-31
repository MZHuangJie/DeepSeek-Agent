import React, { useState, useCallback } from 'react';
import styles from './BalanceSection.module.css';

export interface BalanceInfo {
  balance: number; // 账户余额（元）
  monthlyUsed: number; // 当月已消耗（元）
  monthlyBudget: number; // 月度预算（元）
  lastUpdated: number; // 最后更新时间戳 (ms)
}

interface BalanceSectionProps {
  data: BalanceInfo | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

function fmtCurrency(n: number): string {
  if (n >= 1000) return `¥ ${n.toFixed(2)}`;
  if (n >= 1) return `¥ ${n.toFixed(2)}`;
  return `¥ ${n.toFixed(4)}`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  return `${Math.floor(diff / 3_600_000)} 小时前`;
}

export default function BalanceSection({ data, loading, error, onRefresh }: BalanceSectionProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    onRefresh();
    // 模拟刷新动画最小持续时间
    setTimeout(() => setRefreshing(false), 600);
  }, [onRefresh]);

  // ---- 无数据：占位符 ----
  if (!data && !loading && !error) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <span>DeepSeek 账户</span>
          <button className={styles.refreshBtn} onClick={handleRefresh} title="刷新余额">
            <span className={`${styles.refreshIcon} ${refreshing ? styles.spinning : ''}`}>↻</span>
          </button>
        </div>
        <div className={styles.placeholder}>
          <span className={styles.placeholderIcon}>💳</span>
          <span>暂无余额数据</span>
          <span className={styles.placeholderHint}>点击刷新获取 DeepSeek API 余额</span>
        </div>
      </div>
    );
  }

  // ---- 加载中 ----
  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <span>DeepSeek 账户</span>
        </div>
        <div className={styles.placeholder}>
          <div className={styles.skeletonLine} style={{ width: '60%' }} />
          <div className={styles.skeletonLine} style={{ width: '80%', marginTop: 8 }} />
        </div>
      </div>
    );
  }

  // ---- 加载失败 ----
  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <span>DeepSeek 账户</span>
          <button className={styles.refreshBtn} onClick={handleRefresh} title="重试">
            <span className={`${styles.refreshIcon} ${refreshing ? styles.spinning : ''}`}>↻</span>
          </button>
        </div>
        <div className={styles.errorRow}>
          <span className={styles.errorIcon}>⚠️</span>
          <span className={styles.errorText}>{error}</span>
        </div>
      </div>
    );
  }

  // ---- 正常数据 ----
  if (!data) return null; // TS 类型缩窄：已排除 loading/error 后 data 必非空

  const pctUsed = data.monthlyBudget > 0 ? (data.monthlyUsed / data.monthlyBudget) * 100 : 0;
  const remaining = data.balance - data.monthlyUsed;
  const isLowBalance = data.monthlyBudget > 0 && remaining < data.monthlyBudget * 0.15;
  const barColor = pctUsed >= 90 ? '#ef4444' : pctUsed >= 70 ? '#f59e0b' : '#22c55e';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span>DeepSeek 账户</span>
        <button
          className={styles.refreshBtn}
          onClick={handleRefresh}
          title="刷新余额"
          disabled={refreshing}
        >
          <span className={`${styles.refreshIcon} ${refreshing ? styles.spinning : ''}`}>↻</span>
        </button>
      </div>

      {/* 余额大字 */}
      <div className={styles.balanceRow}>
        <span className={styles.balanceAmount}>{fmtCurrency(data.balance)}</span>
        {isLowBalance && (
          <span className={styles.lowBalanceBadge}>余额不足</span>
        )}
      </div>

      {/* 月度消耗进度 */}
      {data.monthlyBudget > 0 && (
        <div className={styles.progressSection}>
          <div className={styles.progressLabels}>
            <span className={styles.progressLabel}>当月消耗</span>
            <span className={styles.progressValue}>
              {fmtCurrency(data.monthlyUsed)} / {fmtCurrency(data.monthlyBudget)}
            </span>
          </div>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${Math.min(pctUsed, 100)}%`, background: barColor }}
            />
          </div>
          <div className={styles.progressPct}>{pctUsed.toFixed(1)}%</div>
        </div>
      )}

      {/* 余额不足警告 */}
      {isLowBalance && (
        <div className={styles.lowBalanceWarning}>
          ⚠️ 余额已不足月度预算的 15%（剩余 {fmtCurrency(remaining)}），建议尽快充值
        </div>
      )}

      {/* 最后更新时间 */}
      <div className={styles.updatedAt}>
        更新于 {timeAgo(data.lastUpdated)}
      </div>
    </div>
  );
}
