import React, { useEffect } from 'react';
import Sidebar from './components/sidebar/Sidebar';
import ChatPanel from './components/chat/ChatPanel';
import AgentPanel from './components/agent/AgentPanel';
import EditorTabs from './components/editor/EditorTabs';
import CodeEditor from './components/editor/CodeEditor';
import TerminalPanel from './components/terminal/TerminalPanel';
import TerminalTabs from './components/terminal/TerminalTabs';
import StatusBar from './components/statusbar/StatusBar';
import { useFilesStore } from './stores/files';
import { useTerminalStore } from './stores/terminal';
import { useChatStore } from './stores/chat';
import { useLayoutStore } from './stores/layout';
import ResizeHandle from './components/layout/ResizeHandle';

export default function App() {
  const { activeTab, openTabs, updateTabContent } = useFilesStore();
  const { activeTermId, createTerminal } = useTerminalStore();
  const { activeSessionId, createSession } = useChatStore();
  const {
    sidebarWidth, agentPanelWidth, terminalHeight, chatPanelWidth,
    bottomExpanded, bottomClosed, bottomPanel, setBottomPanel, setBottomClosed, setBottomExpanded,
    setSidebarWidth, setAgentPanelWidth, setTerminalHeight, setChatPanelWidth,
  } = useLayoutStore();

  const activeFile = openTabs.find(t => t.path === activeTab);

  useEffect(() => {
    if (!activeSessionId) {
      createSession();
    }
    if (!activeTermId) {
      createTerminal();
    }
  }, []);

  const getLanguage = (name: string): string => {
    if (name.endsWith('.ts') || name.endsWith('.tsx')) return 'typescript';
    if (name.endsWith('.js') || name.endsWith('.jsx')) return 'javascript';
    if (name.endsWith('.py')) return 'python';
    if (name.endsWith('.json')) return 'json';
    if (name.endsWith('.md')) return 'markdown';
    if (name.endsWith('.css')) return 'css';
    if (name.endsWith('.html')) return 'html';
    if (name.endsWith('.yml') || name.endsWith('.yaml')) return 'yaml';
    return 'text';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Title Bar */}
      <div style={{
        height: 32, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', position: 'relative',
        WebkitAppRegion: 'drag' as any,
      }}>
        <div style={{ width: 100 }} />
        <span style={{ flex: 1, textAlign: 'center' }}>DeepSeek Agent</span>
        <div style={{ width: 100, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingRight: 12, WebkitAppRegion: 'no-drag' as any }}>
          <button onClick={() => window.api.window.minimize()} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
            <img src="/assets/图层 11_w.png" alt="minimize" style={{ width: 12, height: 2 }} />
          </button>
          <button onClick={() => window.api.window.maximize()} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
            <img src="/assets/图层 10_w.png" alt="maximize" style={{ width: 12, height: 12 }} />
          </button>
          <button onClick={() => window.api.window.close()} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
            <img src="/assets/图层 12_w.png" alt="close" style={{ width: 12, height: 12 }} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar — 全高 */}
        <div style={{
          width: sidebarWidth, flexShrink: 0, background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border)', height: '100%', overflow: 'hidden',
        }}>
          <Sidebar />
        </div>

        <ResizeHandle direction="horizontal" onResize={(d) => setSidebarWidth(w => Math.max(180, w + d))} />

        {/* 中间区域（Editor + Chat + Bottom Panel） */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* 上半：Editor + Chat */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
            {/* Editor Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <EditorTabs />
              <div style={{ flex: 1, overflow: 'hidden', display: activeFile ? 'block' : 'none' }}>
                {activeFile && (
                  <CodeEditor
                    content={activeFile.content || '// Select a file to view its contents'}
                    language={getLanguage(activeFile.name)}
                    onChange={(value) => value !== undefined && updateTabContent(activeFile.path, value)}
                  />
                )}
              </div>
            </div>

            <ResizeHandle direction="horizontal" onResize={(d) => setChatPanelWidth(w => Math.max(260, w - d))} />

            {/* Chat Panel */}
            <div style={{
              width: chatPanelWidth, flexShrink: 0, overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              borderLeft: '1px solid var(--border)',
            }}>
              {activeSessionId ? (
                <ChatPanel />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                  新建会话开始对话
                </div>
              )}
            </div>
          </div>

          {/* Bottom Panel Area — 只在中间区域下面 */}
          {bottomClosed ? (
            <div
              style={{
                height: 22, background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)',
                flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 12, padding: '0 12px',
              }}
            >
              {(['terminal', 'problems', 'output', 'debug'] as const).map(p => (
                <span
                  key={p}
                  onClick={() => {
                    setBottomClosed(false);
                    setBottomExpanded(true);
                    setBottomPanel(p);
                  }}
                  style={{
                    fontSize: 10, color: 'var(--text-secondary)', cursor: 'pointer',
                    textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500,
                    padding: '2px 6px', borderRadius: 3,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = '#fff';
                    e.currentTarget.style.background = 'var(--bg-tertiary)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = 'var(--text-secondary)';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {p === 'terminal' && 'Terminal'}
                  {p === 'problems' && 'Problems'}
                  {p === 'output' && 'Output'}
                  {p === 'debug' && 'Debug Console'}
                </span>
              ))}
            </div>
          ) : (
            <>
              <ResizeHandle direction="vertical" onResize={(d) => {
                if (!bottomExpanded) { setBottomExpanded(true); }
                setTerminalHeight(h => Math.max(80, h + d));
              }} />
              <div style={{
                height: bottomExpanded ? terminalHeight : 28,
                flexShrink: 0, background: 'var(--terminal-bg)',
                borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
              }}>
                <TerminalTabs />
                {bottomExpanded && (
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    {bottomPanel === 'terminal' && activeTermId && <TerminalPanel termId={activeTermId} />}
                    {bottomPanel === 'problems' && <PlaceholderPanel title="PROBLEMS" message="暂无问题" />}
                    {bottomPanel === 'output' && <PlaceholderPanel title="OUTPUT" message="暂无输出" />}
                    {bottomPanel === 'debug' && <PlaceholderPanel title="DEBUG CONSOLE" message="调试控制台" />}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <ResizeHandle direction="horizontal" onResize={(d) => setAgentPanelWidth(w => Math.max(200, w - d))} />

        {/* Agent Panel — 全高 */}
        <div style={{
          width: agentPanelWidth, flexShrink: 0, background: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border)', height: '100%', overflow: 'hidden',
        }}>
          <AgentPanel />
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar language={activeFile ? getLanguage(activeFile.name) : ''} />
    </div>
  );
}

function PlaceholderPanel({ title, message }: { title: string; message: string }) {
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)',
      fontSize: 13, gap: 8,
    }}>
      <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.6 }}>{title}</span>
      <span>{message}</span>
    </div>
  );
}
