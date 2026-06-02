// src/renderer/components/chat/ChatWorkspace.tsx
import React from 'react';
import { useAgentStore } from '../../stores/agent';
import { useConversationStore } from '../../stores/conversationStore';
import ChatPanel from './ChatPanel';
import AgentProcessPanel from './AgentProcessPanel';
import styles from './ChatWorkspace.module.css';

export default function ChatWorkspace() {
  const { subAgents, processPanelDismissed, dismissProcessPanel, reopenProcessPanel } = useAgentStore();
  const { conversations, activeId } = useConversationStore();
  const showProcessPanel = subAgents.length > 0 && !processPanelDismissed;
  const activeConv = conversations.find(c => c.id === activeId);

  return (
    <div className={styles.workspace}>
      <div className={styles.titleBar}>
        {activeConv ? (
          <>
            <span className={styles.titleText}>{activeConv.title}</span>
            {activeConv.type === 'group_npc' && <span className={styles.titleBadge}>🎭 NPC 群聊 · {activeConv.members.length}人</span>}
            {activeConv.type === 'group_agent' && <span className={styles.titleBadge}>💼 Agent 群聊 · {activeConv.members.length}人</span>}
          </>
        ) : (
          <span className={styles.titleText}>新建会话</span>
        )}
        {subAgents.length > 0 && processPanelDismissed && (
          <button
            className={styles.processToggleBtn}
            onClick={reopenProcessPanel}
            title="展开子代理面板"
          >
            🤖 {subAgents.length}
          </button>
        )}
      </div>
      <div className={styles.body}>
        <div className={styles.chatColumn}>
          {activeId ? (
            <ChatPanel />
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100%', color: 'var(--text-secondary)', fontSize: 13,
            }}>
              选择或创建一个会话开始对话
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
