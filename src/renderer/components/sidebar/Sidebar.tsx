import React from 'react';
import FileTree from './FileTree';

export default function Sidebar() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '10px 12px', fontWeight: 600, fontSize: 12, borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        📁 文件
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <FileTree />
      </div>
    </div>
  );
}
