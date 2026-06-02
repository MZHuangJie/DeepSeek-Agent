import React from 'react';
import styles from './AboutDialog.module.css';

interface Props {
  onClose: () => void;
}

export default function AboutDialog({ onClose }: Props) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <img src="/assets/logo.png" alt="" className={styles.logo} />
        <div className={styles.title}>Oh My DeepSeek</div>
        <div className={styles.version}>版本 1.0.0</div>
        <div className={styles.desc}>
          基于 Electron 的 AI 编程助手，支持 Agent 对话、子代理协作、终端与多模态能力。
        </div>
        <button type="button" className={styles.closeBtn} onClick={onClose}>确定</button>
      </div>
    </div>
  );
}
