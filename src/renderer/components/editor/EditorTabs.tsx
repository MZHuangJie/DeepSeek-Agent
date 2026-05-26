import React, { useState, useEffect } from 'react';
import { useFilesStore } from '../../stores/files';
import { getFileIconInfo } from '../../utils/icons';
import { GitIconDiff } from '../git/GitIcons';
import shared from '../../styles/components.module.css';
import styles from './EditorTabs.module.css';

function FileIcon({ name }: { name: string }) {
  const info = getFileIconInfo(name);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, fontSize: info.text.length <= 2 ? 9 : 7, fontWeight: 700, color: info.color, fontFamily: 'Consolas, "Courier New", monospace', lineHeight: 1, userSelect: 'none' }} title={name}>
      {info.text}
    </span>
  );
}

interface MenuState { visible: boolean; x: number; y: number; tabPath: string; }

export default function EditorTabs() {
  const { openTabs, activeTab, closeTab, closeTabsToRight, closeOtherTabs, closeAllTabs, setActiveTab } = useFilesStore();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<MenuState>({ visible: false, x: 0, y: 0, tabPath: '' });

  useEffect(() => {
    const hide = () => setMenu(m => ({ ...m, visible: false }));
    window.addEventListener('click', hide);
    window.addEventListener('resize', hide);
    return () => { window.removeEventListener('click', hide); window.removeEventListener('resize', hide); };
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    if (containerRef.current) { e.preventDefault(); containerRef.current.scrollLeft += e.deltaY; }
  };

  if (openTabs.length === 0) return null;

  return (
    <>
      <div ref={containerRef} onWheel={handleWheel} className={styles.container}>
        {openTabs.map(tab => {
          const isActive = activeTab === tab.path;
          const isDirty = tab.kind === 'file' && tab.content !== tab.originalContent;
          return (
            <div key={tab.path} onClick={() => setActiveTab(tab.path)} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setMenu({ visible: true, x: e.clientX, y: e.clientY, tabPath: tab.path }); }}
              className={`${shared.editorTab} ${isActive ? shared.editorTabActive : shared.editorTabInactive} ${isActive ? styles.tabActiveBg : styles.tabBg}`}
            >
              {tab.kind === 'diff' ? (
                <span className={styles.diffTabIcon} title="Diff">
                  <GitIconDiff size={12} />
                </span>
              ) : (
                <FileIcon name={tab.name} />
              )}
              <span>{tab.name}</span>
              <span className={shared.dirtyDot} style={{ background: isDirty ? 'var(--accent)' : 'transparent' }} title={isDirty ? '未保存' : ''} />
              <span onClick={(e) => { e.stopPropagation(); closeTab(tab.path); }} title="关闭" className={shared.closeTab}>
                <img src="/assets/图层 12_w.png" alt="close" className={styles.closeIcon} />
              </span>
            </div>
          );
        })}
      </div>
      {menu.visible && (
        <div onClick={e => e.stopPropagation()} className={styles.contextMenu} style={{ top: menu.y, left: menu.x }}>
          <MenuItem onClick={() => { closeTab(menu.tabPath); setMenu(m => ({ ...m, visible: false })); }}>关闭</MenuItem>
          <MenuItem onClick={() => { closeOtherTabs(menu.tabPath); setMenu(m => ({ ...m, visible: false })); }}>关闭其他</MenuItem>
          <MenuItem onClick={() => { closeTabsToRight(menu.tabPath); setMenu(m => ({ ...m, visible: false })); }}>关闭右侧</MenuItem>
          <MenuItem onClick={() => { closeAllTabs(); setMenu(m => ({ ...m, visible: false })); }}>关闭全部</MenuItem>
        </div>
      )}
    </>
  );
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <div onClick={onClick} className={shared.menuItem}>{children}</div>;
}
