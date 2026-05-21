import React from 'react';

export type PanelView = 'files' | 'sessions' | 'browser' | 'agent';

interface Props {
  openView: PanelView | null;
  onToggle: (view: PanelView) => void;
}

const ITEMS: Array<{ id: PanelView; label: string; icon: string }> = [
  { id: 'files', label: '文件', icon: '/assets/file.png' },
  { id: 'sessions', label: '会话', icon: '/assets/session.png' },
  { id: 'browser', label: '浏览器', icon: '/assets/web.png' },
  { id: 'agent', label: 'AGENT', icon: '/assets/usaged.png' },
];

export default function ActivityBar({ openView, onToggle }: Props) {
  return (
    <div style={{
      width: 44, flexShrink: 0, background: 'var(--bg-tertiary)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      paddingTop: 8, gap: 2,
    }}>
      {ITEMS.map(item => {
        const isActive = openView === item.id;
        return (
          <div
            key={item.id}
            onClick={() => onToggle(item.id)}
            title={item.label}
            style={{
              width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, cursor: 'pointer', borderRadius: 6,
              background: isActive ? 'var(--accent)' : 'transparent',
              opacity: isActive ? 1 : 0.5,
              transition: 'all 0.15s',
              position: 'relative',
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.opacity = '0.8'; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.opacity = '0.5'; }}
          >
            <img src={item.icon} alt={item.label} style={{ width: 18, height: 18 }} />
            {isActive && (
              <div style={{
                position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                width: 2, height: 20, background: '#fff', borderRadius: 1,
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
