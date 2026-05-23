import React from 'react';
import styles from '../../styles/components.module.css';

export type PanelView = 'files' | 'sessions' | 'browser' | 'agent' | 'modify';

interface Props {
  openView: PanelView | null;
  onToggle: (view: PanelView) => void;
  onOpenSettings?: () => void;
  onToggleTerminal?: () => void;
}

const ITEMS: Array<{ id: PanelView; label: string; icon: string }> = [
  { id: 'files', label: '文件', icon: '/assets/file.png' },
  { id: 'sessions', label: '会话', icon: '/assets/session.png' },
  { id: 'browser', label: '浏览器', icon: '/assets/web.png' },
  { id: 'agent', label: 'AGENT', icon: '/assets/usaged.png' },
  { id: 'modify', label: '文件修改', icon: '' },
];

function BarBtn({ icon, title, onClick, active }: { icon: string; title: string; onClick: () => void; active?: boolean }) {
  return (
    <div onClick={onClick} title={title} className={styles.barBtn}
      style={{ background: active ? 'var(--accent)' : 'transparent', opacity: active ? 1 : 0.5 }}
    >
      {icon ? <img src={icon} alt={title} style={{ width: 18, height: 18 }} /> : <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>M</span>}
      {active && <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 2, height: 20, background: '#fff', borderRadius: 1 }} />}
    </div>
  );
}

export default function ActivityBar({ openView, onToggle, onOpenSettings, onToggleTerminal }: Props) {
  return (
    <div style={{
      width: 44, flexShrink: 0, background: 'var(--bg-tertiary)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      paddingTop: 8, gap: 7,
    }}>
      {ITEMS.map(item => (
        <BarBtn
          key={item.id}
          icon={item.icon}
          title={item.label}
          active={openView === item.id}
          onClick={() => onToggle(item.id)}
        />
      ))}

      {/* 底部操作按钮 */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, paddingBottom: 8 }}>
        {onToggleTerminal && (
          <BarBtn icon="/assets/3.png" title="终端" onClick={onToggleTerminal} />
        )}
        {onOpenSettings && (
          <BarBtn icon="/assets/5.png" title="模型设置" onClick={onOpenSettings} />
        )}
      </div>
    </div>
  );
}
