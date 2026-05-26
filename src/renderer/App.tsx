import React, { useEffect } from 'react';
import styles from './styles/components.module.css';
import Sidebar from './components/sidebar/Sidebar';
import SessionList from './components/sidebar/SessionList';
import ModifyPanel from './components/agent/ModifyPanel';
import GitPanel from './components/sidebar/GitPanel';
import ActivityBar, { PanelView, SystemMenuAction } from './components/sidebar/ActivityBar';
import BrowserView from './components/chat/BrowserView';
import ChatWorkspace from './components/chat/ChatWorkspace';
import AgentPanel from './components/agent/AgentPanel';
import EditorTabs from './components/editor/EditorTabs';
import CodeEditor from './components/editor/CodeEditor';
import DiffView from './components/editor/DiffView';
import ImageViewer, { isImageFile } from './components/editor/ImageViewer';
import TerminalPanel from './components/terminal/TerminalPanel';
import TerminalTabs from './components/terminal/TerminalTabs';
import TerminalList from './components/terminal/TerminalList';
import StatusBar from './components/statusbar/StatusBar';
import ModelSettings from './components/settings/ModelSettings';
import ThemeSettings from './components/settings/ThemeSettings';
import AboutDialog from './components/settings/AboutDialog';
import CharacterSettings from './components/settings/CharacterSettings';
import GitPassphraseDialog from './components/git/GitPassphraseDialog';
import QuickOpen from './components/chat/QuickOpen';
import { useFilesStore } from './stores/files';
import { useTerminalStore } from './stores/terminal';
import { useChatStore } from './stores/chat';
import { useLayoutStore, SIDEBAR_MIN_WIDTH } from './stores/layout';
import { useBrowserStore } from './stores/browser';
import ResizeHandle from './components/layout/ResizeHandle';
import SidebarResizeHandle from './components/layout/SidebarResizeHandle';

export default function App() {
  const { activeTab, openTabs, updateTabContent, saveFile } = useFilesStore();
  const { activeTermId, createTerminal } = useTerminalStore();
  const { loadSessions } = useChatStore();
  const {
    sidebarWidth, agentPanelWidth, terminalHeight, chatPanelWidth,
    bottomExpanded, bottomClosed, setBottomClosed, setBottomExpanded,
    setSidebarWidth, setAgentPanelWidth, setTerminalHeight, setChatPanelWidth,
  } = useLayoutStore();

  const activeFile = openTabs.find(t => t.path === activeTab);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const state = useFilesStore.getState();
        if (state.activeTab) state.saveFile(state.activeTab);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        setShowQuickOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const [showModelSettings, setShowModelSettings] = React.useState(false);
  const [showThemeSettings, setShowThemeSettings] = React.useState(false);
  const [showAbout, setShowAbout] = React.useState(false);
  const [showCharacterSettings, setShowCharacterSettings] = React.useState(false);
  const [showQuickOpen, setShowQuickOpen] = React.useState(false);
  const [sidebarResizing, setSidebarResizing] = React.useState(false);
  const [askpassRequest, setAskpassRequest] = React.useState<{ id: string; prompt: string; keyPath: string } | null>(null);
  const [openView, setOpenView] = React.useState<PanelView | null>(null);
  const { url: browserUrl, open: browserOpen, setOpen: setBrowserOpen } = useBrowserStore();
  const handleToggleView = (view: PanelView) => {
    if (view === 'browser') {
      setBrowserOpen(!browserOpen);
      if (!browserOpen) setOpenView(null);
    } else {
      setBrowserOpen(false);
      setOpenView(prev => prev === view ? null : view);
    }
  };

  // 监听工具调用的 browser:load-url
  useEffect(() => {
    const unsub = window.api.browser.onLoadUrl((url) => {
      setBrowserOpen(true);
      useBrowserStore.getState().setUrl(url);
    });
    return unsub;
  }, [setBrowserOpen]);

  // 同步 browser store 的 open 状态到面板
  React.useEffect(() => {
    if (browserOpen) setOpenView(null); // 关闭其他面板
  }, [browserOpen]);

  // 监听 present_web 传来的 URL，自动打开浏览器面板
  useEffect(() => {
    const unsubscribe = window.api.browser.onLoadUrl((url) => {
      setBrowserOpen(true);
      useBrowserStore.getState().setUrl(url);
    });
    return unsubscribe;
  }, [setBrowserOpen]);

  useEffect(() => {
    const unsub = window.api.git.onAskpassRequest(req => {
      setAskpassRequest(prev => prev ?? req);
    });
    return unsub;
  }, []);

  // 浏览器视图用 65% 宽度，其他面板用 sidebarWidth
  const isBrowserVisible = openView === 'browser' || browserOpen;
  const leftPanelWidth = isBrowserVisible ? '65%' : sidebarWidth;
  const isLeftOpen = isBrowserVisible || (openView && openView !== 'agent');

  const hasInitRef = React.useRef(false);
  useEffect(() => {
    if (hasInitRef.current) return;
    hasInitRef.current = true;
    loadSessions();
    if (!activeTermId) {
      createTerminal();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const state = useFilesStore.getState();
        if (state.activeTab) {
          state.saveFile(state.activeTab);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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

  const handleSystemAction = (action: SystemMenuAction) => {
    if (action === 'theme') setShowThemeSettings(true);
    else if (action === 'terminal') { setBottomClosed(false); setBottomExpanded(true); }
    else if (action === 'model') setShowModelSettings(true);
    else if (action === 'characters') setShowCharacterSettings(true);
    else if (action === 'about') setShowAbout(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Title Bar */}
      <div style={{
        height: 32, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', position: 'relative',
        WebkitAppRegion: 'drag',
      }}>
        <div style={{ width: 100 }} />
        <span style={{ flex: 1, textAlign: 'center' }}><img src="/assets/logo.png" alt="" style={{ width: 16, height: 14, marginRight: 6, verticalAlign: 'middle' }} />DeepSeek Agent</span>
        <div style={{ width: 100, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingRight: 12, WebkitAppRegion: 'no-drag' }}>
          <WindowControlBtn onClick={() => window.api.window.minimize()}>
            <img src="/assets/图层 11_w.png" alt="minimize" style={{ width: 12, height: 2 }} />
          </WindowControlBtn>
          <WindowControlBtn onClick={() => window.api.window.maximize()}>
            <img src="/assets/图层 10_w.png" alt="maximize" style={{ width: 12, height: 12 }} />
          </WindowControlBtn>
          <WindowControlBtn onClick={() => window.api.window.close()}>
            <img src="/assets/图层 12_w.png" alt="close" style={{ width: 12, height: 12 }} />
          </WindowControlBtn>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Activity Bar — 最左边 */}
        <ActivityBar
          openView={isBrowserVisible ? 'browser' : openView}
          onToggle={handleToggleView}
          onSystemAction={handleSystemAction}
        />

        {/* Left Panel — files/sessions/browser 滑动面板 */}
        <div data-area="sidebar" style={{
          width: isLeftOpen ? leftPanelWidth : 0,
          flexShrink: 0, background: 'var(--bg-secondary)',
          borderRight: isLeftOpen ? '1px solid var(--border)' : 'none',
          height: '100%', overflow: 'hidden',
          transition: sidebarResizing ? 'none' : 'width 0.2s ease',
        }}>
          <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
            {!isBrowserVisible && openView === 'files' && <Sidebar />}
            {!isBrowserVisible && openView === 'sessions' && <SessionList />}
            {!isBrowserVisible && openView === 'modify' && <ModifyPanel />}
            {!isBrowserVisible && openView === 'git' && <GitPanel />}
            {isBrowserVisible && <BrowserView initialUrl={browserUrl} />}
          </div>
        </div>
        {isLeftOpen && !isBrowserVisible && (
          <SidebarResizeHandle
            width={sidebarWidth}
            minWidth={SIDEBAR_MIN_WIDTH}
            onWidthChange={setSidebarWidth}
            onCollapse={() => {
              setBrowserOpen(false);
              setOpenView(null);
            }}
            onDragStart={() => setSidebarResizing(true)}
            onDragEnd={() => setSidebarResizing(false)}
          />
        )}

        {/* 中间区域（Editor + Chat + Bottom Panel） */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* 上半：Editor + Chat */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
            {/* Editor Area — 仅在有打开的文件时显示 */}
            {openTabs.length > 0 && (
              <>
                <div data-area="editor" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <EditorTabs />
                  <div style={{ flex: 1, overflow: 'hidden', display: activeFile ? 'flex' : 'none', flexDirection: 'column', minHeight: 0 }}>
                    {activeFile?.kind === 'diff' ? (
                      activeFile.diffOriginal === activeFile.diffModified ? (
                        <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>无差异</div>
                      ) : (
                        <DiffView
                          original={activeFile.diffOriginal || ''}
                          modified={activeFile.diffModified || ''}
                          language={activeFile.language || 'text'}
                          originalLabel={activeFile.originalLabel}
                          modifiedLabel={activeFile.modifiedLabel}
                          fill
                          inline={false}
                        />
                      )
                    ) : activeFile && isImageFile(activeFile.name) ? (
                      <ImageViewer filePath={activeFile.path} />
                    ) : activeFile ? (
                      <CodeEditor
                        filePath={activeFile.path}
                        content={activeFile.content || '// Select a file to view its contents'}
                        language={getLanguage(activeFile.name)}
                        onChange={(value) => value !== undefined && updateTabContent(activeFile.path, value)}
                      />
                    ) : null}
                  </div>
                </div>
                <ResizeHandle direction="horizontal" onResize={(d) => setChatPanelWidth(w => Math.max(260, w - d))} />
              </>
            )}
            <div data-area="chat" style={{
              width: openTabs.length > 0 ? chatPanelWidth : '100%',
              flex: openTabs.length > 0 ? '0 0 auto' : 1,
              flexShrink: 0, overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              background: 'var(--bg-primary)', color: 'var(--text-primary)',
              borderLeft: openTabs.length > 0 ? '1px solid var(--border)' : 'none',
            }}>
              <ChatWorkspace />
            </div>
          </div>
          {/* Bottom Panel */}
          {bottomClosed ? (
            <div style={{ height: 4, background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', flexShrink: 0 }} />
          ) : (
            <>
              <ResizeHandle direction="vertical" onResize={(d) => {
                if (!bottomExpanded) { setBottomExpanded(true); }
                setTerminalHeight(h => Math.max(80, h - d));
              }} />
              <div data-area="terminal" style={{
                height: bottomExpanded ? terminalHeight : 28, flexShrink: 0,
                background: 'var(--terminal-bg)', borderTop: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column',
              }}>
                <TerminalTabs />
                {bottomExpanded && activeTermId && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <TerminalPanel termId={activeTermId} />
                    </div>
                    <TerminalList />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Agent Panel — 右侧滑动面板 */}
        <div data-area="agentPanel" style={{
          width: openView === 'agent' ? agentPanelWidth : 0,
          flexShrink: 0, background: 'var(--bg-secondary)',
          borderLeft: openView === 'agent' ? '1px solid var(--border)' : 'none',
          height: '100%', overflow: 'hidden',
          transition: 'width 0.2s ease',
        }}>
          <div style={{ width: agentPanelWidth, height: '100%' }}>
            <AgentPanel />
          </div>
        </div>
        {openView === 'agent' && (
          <ResizeHandle direction="horizontal" onResize={(d) => setAgentPanelWidth(w => Math.max(200, w - d))} />
        )}
      </div>

      {/* Status Bar */}
      {showModelSettings && <ModelSettings onClose={() => setShowModelSettings(false)} />}
      {showThemeSettings && <ThemeSettings onClose={() => setShowThemeSettings(false)} />}
      {showCharacterSettings && <CharacterSettings onClose={() => setShowCharacterSettings(false)} />}
      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
      {showQuickOpen && <QuickOpen onClose={() => setShowQuickOpen(false)} />}
      {askpassRequest && (
        <GitPassphraseDialog
          prompt={askpassRequest.prompt}
          keyPath={askpassRequest.keyPath}
          onSubmit={(password, remember) => {
            window.api.git.askpassResponse({ id: askpassRequest.id, password, remember });
            setAskpassRequest(null);
          }}
          onCancel={() => {
            window.api.git.askpassResponse({ id: askpassRequest.id, cancelled: true });
            setAskpassRequest(null);
          }}
        />
      )}
      <StatusBar language={activeFile ? (activeFile.kind === 'diff' ? activeFile.language || '' : getLanguage(activeFile.name)) : ''} />
    </div>
  );
}

function WindowControlBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className={styles.windowBtn}>{children}</button>;
}
