import React, { useState, useRef, useEffect } from 'react';
import { useFilesStore } from '../../stores/files';
import { getFileIconInfo } from '../../utils/icons';

function FileIcon({ name }: { name: string }) {
  const info = getFileIconInfo(name);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 14,
        height: 14,
        fontSize: info.text.length <= 2 ? 9 : 7,
        fontWeight: 700,
        color: info.color,
        fontFamily: 'Consolas, "Courier New", monospace',
        lineHeight: 1,
        userSelect: 'none',
      }}
      title={name}
    >
      {info.text}
    </span>
  );
}

interface MenuState {
  visible: boolean;
  x: number;
  y: number;
  tabPath: string;
}

export default function EditorTabs() {
  const { openTabs, activeTab, closeTab, closeTabsToRight, closeOtherTabs, closeAllTabs, setActiveTab } = useFilesStore();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<MenuState>({ visible: false, x: 0, y: 0, tabPath: '' });

  useEffect(() => {
    const hide = () => setMenu(m => ({ ...m, visible: false }));
    window.addEventListener('click', hide);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('click', hide);
      window.removeEventListener('resize', hide);
    };
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    if (containerRef.current) {
      e.preventDefault();
      containerRef.current.scrollLeft += e.deltaY;
    }
  };

  const handleContextMenu = (e: React.MouseEvent, tabPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ visible: true, x: e.clientX, y: e.clientY, tabPath });
  };

  const handleShowInExplorer = async (tabPath: string) => {
    await window.api.files.showInExplorer(tabPath);
  };

  if (openTabs.length === 0) return null;

  return (
    <>
      <div
        ref={containerRef}
        onWheel={handleWheel}
        className="editor-tabs-scroll"
        style={{
          display: 'flex',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border)',
          overflow: 'auto',
        }}
      >
        {openTabs.map(tab => (
          <div
            key={tab.path}
            onClick={() => setActiveTab(tab.path)}
            onContextMenu={(e) => handleContextMenu(e, tab.path)}
            style={{
              padding: '4px 12px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
              borderBottom: '1px solid transparent',
              color: activeTab === tab.path ? '#fff' : 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              background: activeTab === tab.path ? '#1e1e1e' : 'transparent',
              borderTopLeftRadius: 4,
              borderTopRightRadius: 4,
            }}
          >
            <FileIcon name={tab.name} />
            <span>{tab.name}</span>
            <span
              style={{
                display: 'inline-block',
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: tab.content !== tab.originalContent ? 'var(--accent)' : 'transparent',
                flexShrink: 0,
              }}
              title={tab.content !== tab.originalContent ? '未保存' : ''}
            />
            <span
              onClick={(e) => { e.stopPropagation(); closeTab(tab.path); }}
              style={{
                marginLeft: 4, width: 16, height: 16, display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', borderRadius: 3,
                opacity: 0.6, transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.background = 'var(--bg-tertiary)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.opacity = '0.6';
                e.currentTarget.style.background = 'transparent';
              }}
              title="关闭"
            >
              <img src="/assets/图层 12_w.png" alt="close" style={{ width: 12, height: 12 }} />
            </span>
          </div>
        ))}
      </div>

      {/* Context Menu */}
      {menu.visible && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: menu.y,
            left: menu.x,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '4px 0',
            minWidth: 180,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            zIndex: 1000,
          }}
        >
          <MenuItem onClick={() => { closeTab(menu.tabPath); setMenu(m => ({ ...m, visible: false })); }}>
            关闭
          </MenuItem>
          <MenuItem onClick={() => { closeOtherTabs(menu.tabPath); setMenu(m => ({ ...m, visible: false })); }}>
            关闭其他
          </MenuItem>
          <MenuItem onClick={() => { closeTabsToRight(menu.tabPath); setMenu(m => ({ ...m, visible: false })); }}>
            关闭右侧
          </MenuItem>
          <MenuItem onClick={() => { closeAllTabs(); setMenu(m => ({ ...m, visible: false })); }}>
            关闭全部
          </MenuItem>
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 8px' }} />
          <MenuItem onClick={() => { handleShowInExplorer(menu.tabPath); setMenu(m => ({ ...m, visible: false })); }}>
            在文件资源管理器中显示
          </MenuItem>
        </div>
      )}
    </>
  );
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '6px 12px',
        fontSize: 12,
        color: 'var(--text-primary)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </div>
  );
}
