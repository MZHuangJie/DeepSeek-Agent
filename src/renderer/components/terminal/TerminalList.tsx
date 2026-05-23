import React from 'react';
import { useTerminalStore } from '../../stores/terminal';
import styles from './TerminalList.module.css';

export default function TerminalList() {
  const { terminals, activeTermId, setActiveTerm, closeTerminal } = useTerminalStore();

  if (terminals.length <= 1) return null;

  return (
    <div className={styles.container}>
      {terminals.map(t => (
        <div
          key={t.id}
          onClick={() => setActiveTerm(t.id)}
          className={`${styles.item} ${t.id === activeTermId ? styles.itemActive : styles.itemInactive}`}
          onMouseEnter={e => {
            if (t.id !== activeTermId) e.currentTarget.style.background = 'var(--bg-tertiary)';
          }}
          onMouseLeave={e => {
            if (t.id !== activeTermId) e.currentTarget.style.background = 'transparent';
          }}
        >
          <span className={styles.prompt}>{'>'}</span>
          <span className={styles.name}>{t.name}</span>
          <span
            onClick={(e) => { e.stopPropagation(); closeTerminal(t.id); }}
            title="关闭终端"
            className={styles.close}
          >
            ×
          </span>
        </div>
      ))}
    </div>
  );
}
