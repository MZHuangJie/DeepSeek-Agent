import React from 'react';
import { useTerminalStore } from '../../stores/terminal';

export default function TerminalList() {
  const { terminals, activeTermId, setActiveTerm, closeTerminal } = useTerminalStore();

  if (terminals.length <= 1) return null;

  return (
    <div style={{
      width: 160,
      flexShrink: 0,
      background: 'var(--bg-secondary)',
      borderLeft: '1px solid var(--border)',
      overflow: 'auto',
      padding: '4px 0',
    }}>
      {terminals.map(t => (
        <div
          key={t.id}
          onClick={() => setActiveTerm(t.id)}
          style={{
            padding: '4px 8px',
            cursor: 'pointer',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: t.id === activeTermId ? '#fff' : 'var(--text-secondary)',
            background: t.id === activeTermId ? 'var(--terminal-bg)' : 'transparent',
            borderLeft: t.id === activeTermId ? '2px solid var(--accent)' : '2px solid transparent',
            transition: 'all 0.1s',
          }}
          onMouseEnter={e => {
            if (t.id !== activeTermId) {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
            }
          }}
          onMouseLeave={e => {
            if (t.id !== activeTermId) {
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <span style={{ opacity: 0.7, fontFamily: 'Consolas, monospace', fontSize: 10 }}>{'>'}</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t.name}
          </span>
          <span
            onClick={(e) => { e.stopPropagation(); closeTerminal(t.id); }}
            style={{
              opacity: 0.4,
              cursor: 'pointer',
              fontSize: 13,
              padding: '0 2px',
              borderRadius: 3,
              lineHeight: 1,
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.background = 'var(--bg-tertiary)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.opacity = '0.4';
              e.currentTarget.style.background = 'transparent';
            }}
            title="关闭终端"
          >
            ×
          </span>
        </div>
      ))}
    </div>
  );
}
