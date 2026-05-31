import React from 'react';
import { useAgentStore } from '../../stores/agent';
import { useChatStore } from '../../stores/chat';
import SessionTabs from './SessionTabs';
import ChatPanel from './ChatPanel';
import AgentProcessPanel from './AgentProcessPanel';
import styles from './ChatWorkspace.module.css';

export default function ChatWorkspace() {
  const { subAgents, processPanelDismissed, dismissProcessPanel } = useAgentStore();
  const { activeSessionId } = useChatStore();
  const showProcessPanel = subAgents.length > 0 && !processPanelDismissed;

  return (
    <div className={styles.workspace}>
      <SessionTabs />
      <div className={styles.body}>
        <div className={styles.chatColumn}>
          {activeSessionId ? (
            <ChatPanel />
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-secondary)',
              fontSize: 13,
            }}>
              点击上方 + 新建会话开始对话
            </div>
          )}
        </div>
        {showProcessPanel && (
          <div className={styles.processColumn}>
            <AgentProcessPanel onClose={dismissProcessPanel} />
          </div>
        )}
      </div>
    </div>
  );
}
