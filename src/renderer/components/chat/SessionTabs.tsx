import React, { useEffect, useRef } from 'react';
import { useChatStore } from '../../stores/chat';
import { displaySessionTitle } from '../../utils/sessionTitle';
import styles from './SessionTabs.module.css';

export default function SessionTabs() {
  const { sessions, activeSessionId, createSession, switchSession, deleteSession } = useChatStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !activeSessionId) return;
    const activeTab = root.querySelector(`[data-session-id="${activeSessionId}"]`);
    activeTab?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeSessionId, sessions.length]);

  return (
    <div className={styles.bar}>
      <div ref={scrollRef} className={styles.tabsScroll}>
        {sessions.map(session => {
          const active = session.id === activeSessionId;
          const title = displaySessionTitle(session.title);
          return (
            <button
              key={session.id}
              type="button"
              data-session-id={session.id}
              className={`${styles.tab} ${active ? styles.tabActive : ''}`}
              onClick={() => switchSession(session.id)}
              title={title}
            >
              <span className={styles.tabTitle}>{title}</span>
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
        <button type="button" className={styles.newBtn} onClick={createSession} title="新建会话">
          <img src="./assets/13.png" alt="new" className={styles.newBtnIcon} />
        </button>
      </div>
    </div>
  );
}
