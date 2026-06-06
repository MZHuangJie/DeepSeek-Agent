import React, { useMemo, useState } from 'react';
import { useChatStore } from '../../stores/chat';
import { useTimelineStore } from '../../stores/timeline';
import styles from './TimelinePanel.module.css';

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function preview(msg: { role: string; content: string; toolCalls?: Array<{ name: string }>; thinkingContent?: string }): string {
  if (msg.toolCalls && msg.toolCalls.length > 0) {
    return `🔧 ${msg.toolCalls.map(t => t.name).join(', ')}`;
  }
  if (msg.thinkingContent) {
    return '💭 思考中...';
  }
  const text = (msg.content || '').replace(/\s+/g, ' ').trim();
  return text.slice(0, 40) || '(空)';
}

const HIGHLIGHT_RE = /<mark>(.*?)<\/mark>/g;

export default function TimelinePanel() {
  const { sessions, activeSessionId } = useChatStore();
  const session = sessions.find(s => s.id === activeSessionId);
  const messages = session?.messages ?? [];
  const jumpTo = useTimelineStore(s => s.jumpTo);

  const [search, setSearch] = useState('');

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return messages
      .map((msg, index) => ({ msg, index }))
      .filter(({ msg }) => {
        if (!q) return true;
        const p = preview(msg).toLowerCase();
        const c = (msg.content || '').toLowerCase();
        return p.includes(q) || c.includes(q);
      })
      .reverse();
  }, [messages, search]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>对话时间轴</div>
      <input
        className={styles.search}
        placeholder="搜索消息..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        spellCheck={false}
      />
      <div className={styles.list}>
        {items.length === 0 && (
          <div className={styles.empty}>
            {search ? '无匹配消息' : '暂无消息'}
          </div>
        )}
        {items.map(({ msg, index }) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id || index}
              className={styles.item}
              onClick={() => jumpTo(index)}
              title={`跳转到第 ${index + 1} 条消息`}
            >
              <span className={styles.time}>{fmtTime(msg.timestamp)}</span>
              <span className={styles.role}>
                {isUser ? (
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="12" height="9" rx="2"/><circle cx="8" cy="7.5" r="1.5"/><line x1="8" y1="9" x2="8" y2="12"/><line x1="5" y1="12" x2="11" y2="12"/>
                  </svg>
                )}
              </span>
              <span className={styles.preview}>{preview(msg)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
