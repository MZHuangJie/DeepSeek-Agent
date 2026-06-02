import React from 'react';
import CharacterPanel from '../roleplay/CharacterPanel';
import styles from './CharacterSettings.module.css';

interface Props {
  onClose: () => void;
}

export default function CharacterSettings({ onClose }: Props) {
  return (
    <div className={styles.overlay} data-focus-guard>
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.title}>角色管理</span>
          <button type="button" onClick={onClose} className={styles.closeBtn} aria-label="关闭">
            <img src="./assets/图层 12_w.png" alt="" className={styles.closeIcon} />
          </button>
        </div>
        <div className={styles.body}>
          <CharacterPanel embedded onClose={onClose} />
        </div>
      </div>
    </div>
  );
}
