import React, { useState, useRef, useEffect } from 'react';
import { useFilesStore } from '../../stores/files';
import { getFileIconInfo } from '../../utils/icons';
import styles from '../../styles/components.module.css';

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
      <div ref={containerRef} onWheel={handleWheel} style={{ display: 'flex', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', overflow: 'auto' }}>
        {openTabs.map(tab => {
          const isActive = activeTab === tab.path;
          const isDirty = tab.content !== tab.originalContent;
          return (
            <div key={tab.path} onClick={() => setActiveTab(tab.path)} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setMenu({ visible: true, x: e.clientX, y: e.clientY, tabPath: tab.path }); }}
              className={`${styles.editorTab} ${isActive ? styles.editorTabActive : styles.editorTabInactive}`}
              style={{ background: isActive ? '#1e1e1e' : 'transparent', borderTopLeftRadius: 4, borderTopRightRadius: 4 }}
            >
              <FileIcon name={tab.name} />
              <span>{tab.name}</span>
              <span className={styles.dirtyDot} style={{ background: isDirty ? 'var(--accent)' : 'transparent' }} title={isDirty ? '未保存' : ''} />
              <span onClick={(e) => { e.stopPropagation(); closeTab(tab.path); }} title="关闭" className={styles.closeTab}>
                <img src="/assets/图层 12_w.png" alt="close" style={{ width: 12, height: 12 }} />
              </span>
            </div>
          );
        })}
      </div>
      {menu.visible && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: menu.y, left: menu.x, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 0', minWidth: 180, boxShadow: '0 4px 16px rgba(0,0,0,0.4)', zIndex: 1000 }}>
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
  return <div onClick={onClick} className={styles.menuItem}>{children}</div>;
}
