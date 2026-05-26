import React from 'react';
import { useChatStore } from '../../stores/chat';
import styles from './SessionTabs.module.css';

export default function SessionTabs() {
  const { sessions, activeSessionId, createSession, switchSession, deleteSession } = useChatStore();

  return (
    <div className={styles.bar}>
      <div className={styles.tabs}>
        {sessions.map(session => {
          const active = session.id === activeSessionId;
          return (
            <button
              key={session.id}
              type="button"
              className={`${styles.tab} ${active ? styles.tabActive : ''}`}
              onClick={() => switchSession(session.id)}
              title={session.title}
            >
              <span className={styles.tabTitle}>{session.title}</span>
              {sessions.length > 1 && (
                <span
                  className={styles.closeBtn}
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(session.id);
                  }}
                  title="关闭会话"
                >
                  ×
                </span>
              )}
            </button>
          );
        })}
        {sessions.length === 0 && (
          <button type="button" className={`${styles.tab} ${styles.tabActive}`} onClick={createSession}>
            <span className={styles.tabTitle}>新建会话</span>
          </button>
        )}
      </div>
      <button type="button" className={styles.newBtn} onClick={createSession} title="新建会话">
        <img src="/assets/13.png" alt="new" className={styles.newBtnIcon} />
      </button>
    </div>
  );
}
