import React, { useCallback } from 'react';
import { useAgentStore } from '../../stores/agent';
import CurrentStep from './CurrentStep';
import ToolTimeline from './ToolTimeline';
import ExploreProgress from './ExploreProgress';
import BalanceSection from './BalanceSection';
import TokenUsage from './TokenUsage';
import styles from './AgentPanel.module.css';

export default function AgentPanel({ onClose }: { onClose: () => void }) {
  const { currentStep, toolCalls, balanceInfo, balanceLoading, balanceError, refreshBalance } = useAgentStore();
  const hasData = currentStep || toolCalls.length > 0;

  const handleRefreshBalance = useCallback(() => {
    refreshBalance();
  }, [refreshBalance]);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <img src="/assets/logo.png" alt="agent" className={styles.headerIcon} />
        <span className={styles.headerTitle}>Agent 观测</span>
        <button onClick={onClose} className={styles.closeBtn} title="关闭面板">✕</button>
      </div>

      <div className={styles.content}>
        {!hasData && (
          <div className={styles.emptyHint}>
            发送消息后，此处将显示<br />Agent 的思考过程与工具调用
          </div>
        )}

        {hasData && (
          <>
            <CurrentStep />
            <ToolTimeline />
            <ExploreProgress />
          </>
        )}
      </div>

      {/* DeepSeek 账户余额（独立区块，在 TokenUsage 上方） */}
      <BalanceSection
        data={balanceInfo}
        loading={balanceLoading}
        error={balanceError}
        onRefresh={handleRefreshBalance}
      />

      <div className={styles.tokenFooter}>
        <TokenUsage />
      </div>
    </div>
  );
}
