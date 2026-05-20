import React from 'react';
import { useAgentStore } from '../../stores/agent';

export default function CurrentStep() {
  const { currentStep } = useAgentStore();
  if (!currentStep) return null;

  const isExplore = currentStep.readPercentage !== undefined && currentStep.totalFiles !== undefined;

  return (
    <div style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>
        当前步骤
      </div>
      <div style={{ fontSize: 12, marginBottom: 4, fontWeight: 500 }}>
        {isExplore ? (
          <>已读取 {currentStep.readPercentage}%（{currentStep.readFileCount}/{currentStep.totalFiles} 个文件）</>
        ) : (
          <>第 {currentStep.step} / {currentStep.total} 步</>
        )}
      </div>
      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 4, height: 6, marginBottom: 6, overflow: 'hidden' }}>
        <div style={{
          width: `${isExplore ? Math.min(currentStep.readPercentage ?? 0, 100) : currentStep.progress}%`,
          height: '100%',
          background: isExplore ? '#22c55e' : 'var(--accent)',
          borderRadius: 4,
          transition: 'width 0.3s',
        }} />
      </div>
      <div style={{
        fontSize: 12,
        color: 'var(--text-secondary)',
        lineHeight: 1.4,
        maxHeight: 120,
        overflowY: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        paddingRight: 4,
      }}>
        {currentStep.description}
      </div>
    </div>
  );
}
