import React, { useState } from 'react';
import { useTerminalStore } from '../../stores/terminal';
import { useLayoutStore } from '../../stores/layout';

type PanelKey = 'terminal' | 'problems' | 'output' | 'debug';

const PANELS: { key: PanelKey; label: string }[] = [
  { key: 'terminal', label: 'TERMINAL' },
  { key: 'problems', label: 'PROBLEMS' },
  { key: 'output', label: 'OUTPUT' },
  { key: 'debug', label: 'DEBUG CONSOLE' },
];

export default function TerminalTabs() {
  const { terminals, activeTermId, createTerminal, closeTerminal, setActiveTerm } = useTerminalStore();
  const { bottomPanel, setBottomPanel, bottomExpanded, toggleBottomExpanded, setBottomClosed, terminalHeight, setTerminalHeight } = useLayoutStore();
  const [shellOpen, setShellOpen] = useState(false);
  const [selectedShell, setSelectedShell] = useState(navigator.userAgent.includes('Windows') ? 'powershell' : 'bash');

  const activeTerm = terminals.find(t => t.id === activeTermId);

  const handleShellSelect = (shell: string) => {
    setSelectedShell(shell);
    createTerminal(shell);
    setShellOpen(false);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)', height: 28, flexShrink: 0,
    }}>
      {/* Panel type tabs */}
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', flex: 1, overflow: 'hidden' }}>
        {PANELS.map(p => (
          <div
            key={p.key}
            onClick={() => {
              setBottomPanel(p.key);
              if (p.key === 'terminal') {
                // auto expand when clicking terminal tab
                // keep current state
              }
            }}
            style={{
              padding: '0 10px', display: 'flex', alignItems: 'center', height: '100%',
              fontSize: 11, fontWeight: 500, letterSpacing: 0.5,
              color: bottomPanel === p.key ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              borderBottom: bottomPanel === p.key ? '2px solid var(--accent)' : '2px solid transparent',
              userSelect: 'none',
            }}
          >
            {p.label}
          </div>
        ))}

        {/* Terminal instance tabs (only when terminal panel is active) */}
        {bottomPanel === 'terminal' && (
          <>
            <div style={{ width: 1, height: 14, background: 'var(--border)', margin: '0 4px' }} />
            {terminals.map(t => (
              <div
                key={t.id}
                onClick={() => setActiveTerm(t.id)}
                style={{
                  padding: '0 8px', display: 'flex', alignItems: 'center', gap: 4,
                  height: '100%', cursor: 'pointer', fontSize: 11,
                  color: t.id === activeTermId ? '#fff' : 'var(--text-secondary)',
                  borderTop: t.id === activeTermId ? '1px solid #fff' : '1px solid transparent',
                  background: t.id === activeTermId ? 'var(--terminal-bg)' : 'transparent',
                }}
              >
                <span style={{ opacity: 0.7, fontFamily: 'Consolas, monospace', fontSize: 10 }}>{'>'}</span>
                <span>{t.name}</span>
                <span
                  onClick={(e) => { e.stopPropagation(); closeTerminal(t.id); }}
                  style={{ marginLeft: 2, opacity: 0.5, cursor: 'pointer', fontSize: 12, padding: '0 2px' }}
                  title="关闭终端"
                >
                  ×
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, paddingRight: 8, paddingLeft: 8, flexShrink: 0 }}>
        {/* Shell selector */}
        {bottomPanel === 'terminal' && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShellOpen(!shellOpen)}
              style={{
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', fontSize: 11, padding: '1px 8px',
                borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              {selectedShell}
              <span style={{ fontSize: 8 }}>▼</span>
            </button>
            {shellOpen && (
              <div style={{
                position: 'absolute', bottom: '100%', right: 0, marginBottom: 4,
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 4, padding: '4px 0', minWidth: 100, zIndex: 100,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}>
                {['bash', 'powershell', 'cmd', 'zsh'].map(s => (
                  <div
                    key={s}
                    onClick={() => handleShellSelect(s)}
                    style={{
                      padding: '4px 12px', fontSize: 12, color: 'var(--text-primary)',
                      cursor: 'pointer', textTransform: 'lowercase',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* New terminal */}
        {bottomPanel === 'terminal' && (
          <IconBtn title="新建终端" onClick={() => createTerminal()}>+</IconBtn>
        )}

        {/* Maximize panel */}
        <IconBtn title="最大化" onClick={() => {
          const maxH = Math.floor(window.innerHeight * 0.75);
          setTerminalHeight(terminalHeight < maxH - 50 ? maxH : 180);
        }}>
          <span style={{ fontSize: 10, display: 'inline-block', border: '1px solid currentColor', width: 10, height: 10, lineHeight: '8px', textAlign: 'center' }}>□</span>
        </IconBtn>

        {/* Kill terminal */}
        {bottomPanel === 'terminal' && activeTerm && (
          <IconBtn title="终止终端" onClick={() => activeTermId && closeTerminal(activeTermId)}>
            <span style={{ fontSize: 10 }}>🗑</span>
          </IconBtn>
        )}

        {/* Toggle expand/collapse */}
        <IconBtn title={bottomExpanded ? '收起' : '展开'} onClick={toggleBottomExpanded}>
          <span style={{
            fontSize: 12, display: 'inline-block',
            transform: bottomExpanded ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
          }}>⮥</span>
        </IconBtn>

        {/* Close panel */}
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
      style={{
        background: 'transparent', border: 'none', color: 'var(--text-secondary)',
        cursor: 'pointer', padding: '2px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, borderRadius: 3,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  );
}
