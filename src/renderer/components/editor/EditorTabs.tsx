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
          <img onClick={(e) => { e.stopPropagation(); closeTab(tab.path); }} src="/assets/图层 12_w.png" alt="close" style={{ marginLeft: 4, width: 12, height: 12, opacity: 0.6, cursor: 'pointer' }} />
        </div>
      ))}
    </div>
  );
}
