import React, { useEffect, useRef, useState } from 'react';
import styles from '../../styles/components.module.css';
import barStyles from './ActivityBar.module.css';

export type PanelView = 'files' | 'sessions' | 'browser' | 'agent' | 'modify' | 'git';

export type SystemMenuAction = 'theme' | 'terminal' | 'model' | 'about';

interface Props {
  openView: PanelView | null;
  onToggle: (view: PanelView) => void;
  onSystemAction: (action: SystemMenuAction) => void;
}

const ITEMS: Array<{ id: PanelView; label: string; icon?: string; glyph?: string }> = [
  { id: 'files', label: '文件', icon: '/assets/file.png' },
  { id: 'sessions', label: '会话', icon: '/assets/session.png' },
  { id: 'git', label: 'Git', glyph: '⎇' },
  { id: 'browser', label: '浏览器', icon: '/assets/web.png' },
  { id: 'agent', label: 'AGENT', icon: '/assets/usaged.png' },
  { id: 'modify', label: '文件修改', icon: '/assets/modify.png' },
];

const SYSTEM_MENU: Array<{ id: SystemMenuAction; label: string }> = [
  { id: 'theme', label: '主题设置' },
  { id: 'terminal', label: '打开终端' },
  { id: 'model', label: '模型设置' },
  { id: 'about', label: '关于 DeepSeek-Agent' },
];

function BarBtn({ icon, glyph, title, onClick, active }: { icon?: string; glyph?: string; title: string; onClick: () => void; active?: boolean }) {
  return (
    <div onClick={onClick} title={title} className={styles.barBtn}
      style={{ background: active ? 'var(--accent)' : 'transparent', opacity: active ? 1 : 0.5 }}
    >
      {glyph ? (
        <span style={{ fontSize: 16, lineHeight: 1, fontWeight: 700 }}>{glyph}</span>
      ) : (
        <img src={icon} alt={title} style={{ width: 18, height: 18 }} />
      )}
      {active && <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 2, height: 20, background: '#fff', borderRadius: 1 }} />}
    </div>
  );
}

export default function ActivityBar({ openView, onToggle, onSystemAction }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const handleMenuSelect = (action: SystemMenuAction) => {
    setMenuOpen(false);
    onSystemAction(action);
  };

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
          glyph={item.glyph}
          title={item.label}
          active={openView === item.id}
          onClick={() => onToggle(item.id)}
        />
      ))}

      <div ref={menuRef} className={barStyles.menuAnchor} style={{ marginTop: 'auto', paddingBottom: 8 }}>
        <BarBtn
          icon="/assets/5.png"
          title="系统设置"
          active={menuOpen}
          onClick={() => setMenuOpen(v => !v)}
        />
        {menuOpen && (
          <div className={barStyles.menu} role="menu">
            {SYSTEM_MENU.map(item => (
              <div
                key={item.id}
                role="menuitem"
                className={barStyles.menuItem}
                onClick={() => handleMenuSelect(item.id)}
              >
                {item.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
