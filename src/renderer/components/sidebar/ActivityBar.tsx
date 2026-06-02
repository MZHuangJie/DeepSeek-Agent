import React, { useEffect, useRef, useState } from 'react';
import styles from '../../styles/components.module.css';
import barStyles from './ActivityBar.module.css';
import { useModeStore } from '../../stores/mode';

export type PanelView = 'files' | 'sessions' | 'browser' | 'agent' | 'modify' | 'git' | 'roleplay';

export type SystemMenuAction = 'theme' | 'terminal' | 'model' | 'characters' | 'agent-roles' | 'about';

interface Props {
  openView: PanelView | null;
  onToggle: (view: PanelView) => void;
  onSystemAction: (action: SystemMenuAction) => void;
  onOpenLogin: () => void;
  username: string | null;
  avatar?: string | null;
}

const ITEMS: Array<{ id: PanelView; label: string; icon?: string; glyph?: string }> = [
  { id: 'files', label: '文件', icon: '/assets/file.png' },
  { id: 'sessions', label: '会话', icon: '/assets/session.png' },
  { id: 'git', label: 'Git', icon: '/assets/git.png' },
  { id: 'browser', label: '浏览器', icon: '/assets/web.png' },
  { id: 'agent', label: 'AGENT', icon: '/assets/usaged.png' },
  { id: 'modify', label: '文件修改', icon: '/assets/modify.png' },
];

const SYSTEM_MENU: Array<{ id: SystemMenuAction; label: string }> = [
  { id: 'theme', label: '主题设置' },
  { id: 'terminal', label: '打开终端' },
  { id: 'model', label: '模型设置' },
  { id: 'characters', label: '角色管理' },
  { id: 'agent-roles', label: 'Multi-Agent 角色' },
  { id: 'about', label: '关于 Oh My DeepSeek' },
];

function BarBtn({ icon, glyph, title, onClick, active }: { icon?: string; glyph?: string; title: string; onClick: () => void; active?: boolean }) {
  return (
    <div onClick={onClick} title={title} className={styles.barBtn}
      style={{ background: active ? 'var(--accent)' : 'transparent', opacity: active ? 1 : 0.5 }}
    >
      {glyph ? (
        <span style={{ fontSize: 16, lineHeight: 1, fontWeight: 700 }}>{glyph}</span>
      ) : (
        <img src={icon} alt={title} className={styles.barBtnIcon} />
      )}
      {active && <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 2, height: 20, background: '#fff', borderRadius: 1 }} />}
    </div>
  );
}

export default function ActivityBar({ openView, onToggle, onSystemAction, onOpenLogin, username, avatar }: Props) {
  const mode = useModeStore(s => s.mode);
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
          glyph={'glyph' in item ? item.glyph : undefined}
          title={item.label}
          active={openView === item.id}
          onClick={() => onToggle(item.id)}
        />
      ))}

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, paddingBottom: 8 }}>
        {mode === 'roleplay' && (
          <BarBtn
            icon="/assets/role.png"
            title="角色"
            active={openView === 'roleplay'}
            onClick={() => onToggle('roleplay')}
          />
        )}
        <div
          className={barStyles.avatarBtn}
          onClick={onOpenLogin}
          title={username ? username : '点击登录'}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpenLogin(); }}
        >
          {avatar ? (
            <img src={avatar} className={barStyles.avatarImg} alt={username || ''} />
          ) : username ? (
            <span className={barStyles.avatarLetter}>{username[0]?.toUpperCase()}</span>
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: 'var(--text-muted, #9ca3af)' }}
            >
              {/* 圆形外框 */}
              <circle cx="12" cy="12" r="10" />
              {/* 头部 */}
              <circle cx="12" cy="9.5" r="3" />
              {/* 肩膀 */}
              <path d="M6 19.5c0-2.5 2.5-4.5 6-4.5s6 2 6 4.5" />
            </svg>
          )}
        </div>
        <div ref={menuRef} className={barStyles.menuAnchor}>
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
    </div>
  );
}
