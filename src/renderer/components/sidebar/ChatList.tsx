// src/renderer/components/sidebar/ChatList.tsx
import React, { useState, useMemo } from 'react';
import { useConversationStore } from '../../stores/conversationStore';
import { formatRelativeTime } from '../../utils/relativeTime';
import CreateGroupDialog from '../chat/CreateGroupDialog';
import CloudRestoreDialog from './CloudRestoreDialog';
import styles from './ChatList.module.css';

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function isYesterday(d: Date): boolean {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return isSameDay(d, y);
}

function getTimeGroup(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  if (isSameDay(date, now)) return '今天';
  if (isYesterday(date)) return '昨天';
  if (now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000) return '最近7天';
  return '更早';
}

export default function ChatList() {
  const conversations = useConversationStore(s => s.conversations);
  const activeId = useConversationStore(s => s.activeId);
  const createSolo = useConversationStore(s => s.createSolo);
  const switchTo = useConversationStore(s => s.switchTo);
  const deleteConv = useConversationStore(s => s.delete);
  const [search, setSearch] = useState('');
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState<'group_npc' | 'group_agent' | null>(null);
  const [showCloudDialog, setShowCloudDialog] = useState(false);
  const [pinnedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter(c => c.title.toLowerCase().includes(q));
  }, [conversations, search]);

  const grouped = useMemo(() => {
    const pinned = filtered.filter(c => pinnedIds.has(c.id));
    const others = filtered.filter(c => !pinnedIds.has(c.id));
    const groups = new Map<string, typeof filtered>();

    if (pinned.length > 0) {
      groups.set('置顶', pinned);
    }

    others.forEach(c => {
      const ts = c.lastMessage?.timestamp || c.updatedAt || c.createdAt;
      const g = getTimeGroup(ts);
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(c);
    });

    // Sort each group by time desc
    groups.forEach(list => {
      list.sort((a, b) => {
        const ta = (b.lastMessage?.timestamp || b.updatedAt || b.createdAt) - (a.lastMessage?.timestamp || a.updatedAt || a.createdAt);
        return ta;
      });
    });

    // Order groups
    const order = ['置顶', '今天', '昨天', '最近7天', '更早'];
    const ordered = new Map<string, typeof filtered>();
    order.forEach(k => {
      if (groups.has(k)) ordered.set(k, groups.get(k)!);
    });
    groups.forEach((v, k) => {
      if (!ordered.has(k)) ordered.set(k, v);
    });
    return ordered;
  }, [filtered, pinnedIds]);

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

  const renderTypeBadge = (conv: typeof conversations[0]) => {
    if (conv.type === 'group_npc') {
      return <span className={`${styles.typeBadge} ${styles.typeBadgeNpc}`}>🎭NPC</span>;
    }
    if (conv.type === 'group_agent') {
      return <span className={`${styles.typeBadge} ${styles.typeBadgeAgent}`}>Agent</span>;
    }
    return null;
  };

  const renderUnread = (conv: typeof conversations[0]) => {
    if (conv.id === activeId) return null;
    // Simple unread heuristic: if there are messages and it's not active
    const unread = conv.messages.length > 0 ? Math.min(conv.messages.length, 99) : 0;
    if (unread === 0) return null;
    return <div className={styles.unreadBadge}>{unread}</div>;
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
        <button className={styles.filterBtn} title="筛选">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 4h12M4 8h8M6 12h4" />
          </svg>
        </button>
        <button className={styles.addBtn} title="新建会话" onClick={createSolo}>+</button>
        <button className={styles.addBtn} title="云端会话" onClick={() => setShowCloudDialog(true)}>☁</button>
      </div>

      <div className={styles.list}>
        {Array.from(grouped.entries()).map(([groupName, items]) => (
          <React.Fragment key={groupName}>
            <div className={styles.sectionLabel}>{groupName}</div>
            {items.map(conv => {
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
                      <div className={styles.titleWrap}>
                        <span className={styles.title}>{conv.title}</span>
                        {renderTypeBadge(conv)}
                      </div>
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
                  {hoverId === conv.id ? (
                    <button
                      onClick={e => { e.stopPropagation(); deleteConv(conv.id); }}
                      className={styles.deleteBtn}
                      title="删除会话"
                    >
                      ×
                    </button>
                  ) : (
                    <div className={styles.metaRight}>
                      <span className={styles.time}>
                        {lastMsg ? formatRelativeTime(lastMsg.timestamp) : ''}
                      </span>
                      {renderUnread(conv)}
                    </div>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
        {filtered.length === 0 && (
          <div className={styles.emptyHint}>
            {search ? '无匹配结果' : '点击下方按钮新建'}
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <button className={`${styles.footerBtn} ${styles.npcBtn}`} onClick={() => setShowCreateDialog('group_npc')}>
          <svg className={styles.footerIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a7 7 0 0 1 7 7c0 3.5-2 6-7 11-5-5-7-7.5-7-11a7 7 0 0 1 7-7z"/>
            <path d="M9 9h.01M15 9h.01"/>
            <path d="M8 12c1 1.5 2.5 2 4 2s3-.5 4-2"/>
            <path d="M2 12l2-2M22 12l-2-2"/>
          </svg>
          NPC 群聊
        </button>
        <button className={`${styles.footerBtn} ${styles.agentBtn}`} onClick={() => setShowCreateDialog('group_agent')}>
          <svg className={styles.footerIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="7" width="18" height="13" rx="2"/>
            <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            <path d="M12 12v.01"/>
            <path d="M9 15h6"/>
          </svg>
          Agent 群聊
        </button>
        <button className={`${styles.footerBtn} ${styles.newConvBtn}`} onClick={createSolo}>
          <svg className={styles.footerIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v8M8 12h8"/>
          </svg>
          新会话
        </button>
      </div>
      {showCreateDialog && (
        <CreateGroupDialog
          groupType={showCreateDialog}
          onClose={() => setShowCreateDialog(null)}
        />
      )}
      {showCloudDialog && (
        <CloudRestoreDialog onClose={() => setShowCloudDialog(false)} />
      )}
    </div>
  );
}
