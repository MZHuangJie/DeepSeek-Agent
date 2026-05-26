import React from 'react';
import { useAgentStore } from '../../stores/agent';
import CurrentStep from './CurrentStep';
import ToolTimeline from './ToolTimeline';
import ExploreProgress from './ExploreProgress';
import TokenUsage from './TokenUsage';
import styles from './AgentPanel.module.css';

export default function AgentPanel() {
  const { currentStep, toolCalls } = useAgentStore();
  const hasData = currentStep || toolCalls.length > 0;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <img src="/assets/logo.png" alt="agent" className={styles.headerIcon} />
        <span>Agent 观测</span>
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

      <div className={styles.tokenFooter}>
        <TokenUsage />
      </div>
    </div>
  );
}
