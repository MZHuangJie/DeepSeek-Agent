import React from 'react';
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

export default function EditorTabs() {
  const { openTabs, activeTab, closeTab, setActiveTab } = useFilesStore();

  if (openTabs.length === 0) return null;

  return (
    <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', overflow: 'auto' }}>
      {openTabs.map(tab => (
        <div key={tab.path}
          onClick={() => setActiveTab(tab.path)}
          style={{
            padding: '4px 12px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
            borderBottom: activeTab === tab.path ? '2px solid var(--accent)' : '2px solid transparent',
            color: activeTab === tab.path ? 'var(--accent)' : 'var(--text-secondary)',
            whiteSpace: 'nowrap', background: activeTab === tab.path ? 'rgba(124,58,237,0.08)' : 'transparent',
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
  );
}
