import React from 'react';
import { useAgentStore } from '../../stores/agent';
import CurrentStep from './CurrentStep';
import ToolTimeline from './ToolTimeline';
import ExploreProgress from './ExploreProgress';
import TokenUsage from './TokenUsage';
import SubAgentList from './SubAgentList';

export default function AgentPanel() {
  const { currentStep, toolCalls, subAgents } = useAgentStore();

  const hasData = currentStep || toolCalls.length > 0 || subAgents.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px', fontWeight: 600, fontSize: 12,
        borderBottom: '1px solid var(--border)', textTransform: 'uppercase',
        letterSpacing: 0.5, color: 'var(--text-secondary)',
        display: 'flex', alignItems: 'center', gap: 6,
        flexShrink: 0,
      }}>
        <img src="/assets/logo.png" alt="agent" style={{ width: 20, height: 18 }} />
        <span>Agent 观测</span>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {!hasData && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 12, padding: 20, textAlign: 'center', height: '100%' }}>
            发送消息后，此处将显示<br />Agent 的思考过程与工具调用
          </div>
        )}

        {hasData && (
          <>
            <CurrentStep />
            <SubAgentList />
            <ToolTimeline />
            <ExploreProgress />
          </>
        )}
      </div>

      {/* Fixed bottom: Token Usage */}
      <div style={{
        borderTop: '1px solid var(--border)',
        flexShrink: 0,
        background: 'var(--bg-secondary)',
      }}>
        <TokenUsage />
      </div>
    </div>
  );
}
