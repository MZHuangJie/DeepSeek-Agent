import React from 'react';
import { useAgentStore } from '../../stores/agent';
import styles from './CurrentStep.module.css';

export default function CurrentStep() {
  const { currentStep } = useAgentStore();
  if (!currentStep) return null;

  const isExplore = currentStep.readPercentage !== undefined && currentStep.totalFiles !== undefined;
  if (!isExplore) return null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>当前步骤</div>
      <div className={styles.info}>
        已读取 {currentStep.readPercentage}%（{currentStep.readFileCount}/{currentStep.totalFiles} 个文件）
      </div>
      <div className={styles.bar}>
        <div className={styles.barFill} style={{
          width: `${Math.min(currentStep.readPercentage ?? 0, 100)}%`,
          background: '#22c55e',
        }} />
      </div>
      <div className={styles.desc}>{currentStep.description}</div>
    </div>
  );
}
