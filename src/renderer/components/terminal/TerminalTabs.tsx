import React, { useState } from 'react';
import { useTerminalStore } from '../../stores/terminal';
import { useLayoutStore } from '../../stores/layout';
import styles from './TerminalTabs.module.css';

export default function TerminalTabs() {
  const { terminals, activeTermId, createTerminal, closeTerminal } = useTerminalStore();
  const { bottomExpanded, toggleBottomExpanded, setBottomClosed, setBottomExpanded, terminalHeight, setTerminalHeight } = useLayoutStore();
  const [shellOpen, setShellOpen] = useState(false);
  const isWin = navigator.userAgent.includes('Windows');
  const [selectedShell, setSelectedShell] = useState(isWin ? 'powershell' : 'bash');
  const SHELLS = isWin ? ['powershell', 'cmd'] : ['bash', 'zsh'];

  const activeTerm = terminals.find(t => t.id === activeTermId);

  const handleShellSelect = (shell: string) => {
    setSelectedShell(shell);
    setBottomClosed(false);
    setBottomExpanded(true);
    createTerminal(shell);
    setShellOpen(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.tabArea}>
        <div className={styles.termLabel}>TERMINAL</div>
      </div>

      <div className={styles.controls}>
        {/* Shell selector */}
        <div className={styles.shellBtnWrap}>
          <button
            onClick={() => setShellOpen(!shellOpen)}
            className={styles.shellBtn}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {selectedShell}
            <span className={styles.caret}>▼</span>
          </button>
          {shellOpen && (
            <div className={styles.shellDropdown}>
              {SHELLS.map(s => (
                <div
                  key={s}
                  onClick={() => handleShellSelect(s)}
                  className={styles.shellItem}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>

        <IconBtn title="新建终端" onClick={() => { setBottomClosed(false); setBottomExpanded(true); createTerminal(); }}>+</IconBtn>

        <IconBtn title="最大化" onClick={() => {
          const maxH = Math.floor(window.innerHeight * 0.75);
          setTerminalHeight(terminalHeight < maxH - 50 ? maxH : 180);
        }}>
          <span className={styles.maxIcon}>□</span>
        </IconBtn>

        {activeTerm && (
          <IconBtn title="终止终端" onClick={() => activeTermId && closeTerminal(activeTermId)}>
            <span style={{ fontSize: 10 }}>🗑</span>
          </IconBtn>
        )}

        <IconBtn title={bottomExpanded ? '收起' : '展开'} onClick={toggleBottomExpanded}>
          <span className={styles.toggleIcon} style={{ transform: bottomExpanded ? 'rotate(180deg)' : 'none' }}>⮥</span>
        </IconBtn>

        <IconBtn title="关闭面板" onClick={() => setBottomClosed(true)}>×</IconBtn>
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={styles.iconBtn}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {children}
    </button>
  );
}
