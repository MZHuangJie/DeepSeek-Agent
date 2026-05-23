import React, { useState } from 'react';
import { useChatStore } from '../../stores/chat';
import styles from './SessionList.module.css';

export default function SessionList() {
  const { sessions, activeSessionId, createSession, switchSession, deleteSession } = useChatStore();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Chat Sessions</span>
        <button onClick={createSession} className={styles.newBtn}><img src="/assets/13.png" alt="new" className={styles.newBtnIcon} /></button>
      </div>
      {sessions.map(s => (
        <div
          key={s.id}
          onClick={() => switchSession(s.id)}
          onMouseEnter={() => setHoveredId(s.id)}
          onMouseLeave={() => setHoveredId(null)}
          className={`${styles.sessionItem} ${s.id === activeSessionId ? styles.sessionItemActive : styles.sessionItemInactive}`}
          title={s.title}
        >
          <span className={styles.sessionTitle}>{s.title}</span>
          {(hoveredId === s.id || s.id === activeSessionId) && (
            <button
              onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
              className={styles.deleteBtn}
              title="删除会话"
            >
              ×
            </button>
          )}
        </div>
      ))}
      {sessions.length === 0 && (
        <div className={styles.emptyHint}>点击 + 新建会话</div>
      )}
    </div>
  );
}
