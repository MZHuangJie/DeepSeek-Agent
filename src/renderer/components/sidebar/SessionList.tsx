import React, { useState } from 'react';
import { useChatStore } from '../../stores/chat';
import CloudSyncPanel from './CloudSyncPanel';
import styles from './SessionList.module.css';

export default function SessionList({ onOpenLogin }: { onOpenLogin: () => void }) {
  const { sessions, activeSessionId, createSession, switchSession, deleteSession } = useChatStore();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showCloud, setShowCloud] = useState(false);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Chat Sessions</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            className={styles.newBtn}
            onClick={() => setShowCloud(true)}
            title="云端会话"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
              <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
            </svg>
          </button>
          <button onClick={createSession} className={styles.newBtn}>
            <img src="/assets/13.png" alt="new" className={styles.newBtnIcon} />
          </button>
        </div>
      </div>
      {showCloud && (
        <CloudSyncPanel
          onClose={() => setShowCloud(false)}
          onOpenLogin={onOpenLogin}
        />
      )}
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
