// src/renderer/components/sidebar/ChatList.tsx
import React, { useState, useMemo } from 'react';
import { useConversationStore } from '../../stores/conversationStore';
import { formatRelativeTime } from '../../utils/relativeTime';
import CreateGroupDialog from '../chat/CreateGroupDialog';
import styles from './ChatList.module.css';

export default function ChatList() {
  const { conversations, activeId, createSolo, switchTo, delete: deleteConv } = useConversationStore();
  const [search, setSearch] = useState('');
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState<'group_npc' | 'group_agent' | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter(c => c.title.toLowerCase().includes(q));
  }, [conversations, search]);

  const renderAvatar = (conv: typeof conversations[0]) => {
    if (conv.type === 'solo') {
      const bg = 'linear-gradient(135deg, #667eea, #764ba2)';
      return (
        <div className={`${styles.avatar} ${styles.avatarSolo}`} style={{ background: bg }}>
          {conv.title[0] || '💬'}
        </div>
      );
    }
    const cells = conv.members.slice(0, 4);
    const colors = ['#667eea', '#f5576c', '#4facfe', '#43e97b'];
    return (
      <div className={`${styles.avatar} ${styles.avatarGrid}`}>
        {cells.map((m, i) => (
          <div
            key={m.roleId}
            className={styles.avatarCell}
            style={{ background: m.avatar ? `url(${m.avatar}) center/cover` : colors[i] }}
          >
            {!m.avatar && m.name[0]}
          </div>
        ))}
        {cells.length < 4 && Array.from({ length: 4 - cells.length }).map((_, i) => (
          <div key={`empty-${i}`} className={styles.avatarCell} style={{ background: '#333' }} />
        ))}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.searchBar}>
        <input
          className={styles.searchInput}
          placeholder="🔍 搜索会话"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <div className={styles.list}>
        {filtered.map(conv => {
          const active = conv.id === activeId;
          const lastMsg = conv.lastMessage;
          return (
            <div
              key={conv.id}
              className={`${styles.item} ${active ? styles.itemActive : ''}`}
              onClick={() => switchTo(conv.id)}
              onMouseEnter={() => setHoverId(conv.id)}
              onMouseLeave={() => setHoverId(null)}
            >
              {renderAvatar(conv)}
              <div className={styles.content}>
                <div className={styles.topRow}>
                  <span className={styles.title}>
                    {conv.title}
                    {conv.type === 'group_npc' && (
                      <span className={`${styles.typeBadge} ${styles.typeBadgeNpc}`} style={{ marginLeft: 4 }}>🎭NPC</span>
                    )}
                    {conv.type === 'group_agent' && (
                      <span className={`${styles.typeBadge} ${styles.typeBadgeAgent}`} style={{ marginLeft: 4 }}>💼Agent</span>
                    )}
                  </span>
                  <span className={styles.time}>
                    {lastMsg ? formatRelativeTime(lastMsg.timestamp) : ''}
                  </span>
                </div>
                <div className={styles.bottomRow}>
                  {conv.type !== 'solo' && lastMsg?.senderName && (
                    <span className={styles.senderName} style={{
                      color: conv.type === 'group_npc' ? '#f5576c' : '#4facfe'
                    }}>
                      {lastMsg.senderName}:
                    </span>
                  )}
                  <span className={styles.preview}>
                    {lastMsg?.text || (conv.messages.length === 0 ? '暂无消息' : '')}
                  </span>
                </div>
              </div>
              {(hoverId === conv.id || active) && (
                <button
                  onClick={e => { e.stopPropagation(); deleteConv(conv.id); }}
                  style={{
                    background: 'transparent', border: 'none', color: 'var(--text-secondary)',
                    cursor: 'pointer', fontSize: 14, opacity: 0.6, flexShrink: 0,
                  }}
                  title="删除会话"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className={styles.emptyHint}>
            {search ? '无匹配结果' : '点击下方按钮新建'}
          </div>
        )}
      </div>
      <div className={styles.footer}>
        <button className={`${styles.footerBtn} ${styles.npcBtn}`} onClick={() => setShowCreateDialog('group_npc')}>
          🎭 NPC 群聊
        </button>
        <button className={`${styles.footerBtn} ${styles.agentBtn}`} onClick={() => setShowCreateDialog('group_agent')}>
          💼 Agent 群聊
        </button>
        <button
          className={styles.footerBtn}
          style={{ background: '#07c160', flex: '0 0 auto', padding: '6px 16px' }}
          onClick={createSolo}
        >
          + 新会话
        </button>
      </div>
      {showCreateDialog && (
        <CreateGroupDialog
          groupType={showCreateDialog}
          onClose={() => setShowCreateDialog(null)}
        />
      )}
    </div>
  );
}
