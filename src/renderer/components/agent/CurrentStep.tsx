import React from 'react';
import { useAgentStore } from '../../stores/agent';

export default function CurrentStep() {
  const { currentStep } = useAgentStore();
  if (!currentStep) return null;

  return (
    <div style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>
        当前步骤
      </div>
      <div style={{ fontSize: 12, marginBottom: 4, fontWeight: 500 }}>
        第 {currentStep.step} / {currentStep.total} 步
      </div>
      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 4, height: 6, marginBottom: 6, overflow: 'hidden' }}>
        <div style={{
          width: `${currentStep.progress}%`, height: '100%', background: 'var(--accent)', borderRadius: 4,
          transition: 'width 0.3s',
        }} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
        {currentStep.description}
      </div>
    </div>
  );
}
