import React from 'react';
import { useLayoutStore } from '../../stores/layout';
import FileTree from './FileTree';
import SessionList from './SessionList';

export default function Sidebar() {
  const { sidebarTab, setSidebarTab } = useLayoutStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => setSidebarTab('files')}
          style={{
            flex: 1, padding: '8px', textAlign: 'center', fontSize: 11, fontWeight: sidebarTab === 'files' ? 700 : 400,
            border: 'none', background: 'transparent', color: sidebarTab === 'files' ? 'var(--accent)' : 'var(--text-secondary)',
            borderBottom: sidebarTab === 'files' ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer',
            textTransform: 'uppercase', letterSpacing: 0.5,
          }}>
          <img src="/assets/文件夹.png" alt="files" style={{ width: 14, height: 14, marginRight: 4, verticalAlign: 'middle' }} /> 文件
        </button>
        <button onClick={() => setSidebarTab('sessions')}
          style={{
            flex: 1, padding: '8px', textAlign: 'center', fontSize: 11, fontWeight: sidebarTab === 'sessions' ? 700 : 400,
            border: 'none', background: 'transparent', color: sidebarTab === 'sessions' ? 'var(--accent)' : 'var(--text-secondary)',
            borderBottom: sidebarTab === 'sessions' ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer',
            textTransform: 'uppercase', letterSpacing: 0.5,
          }}>
          <img src="/assets/5.png" alt="chat" style={{ width: 14, height: 14, marginRight: 4, verticalAlign: 'middle' }} /> 会话
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {sidebarTab === 'files' ? <FileTree /> : <SessionList />}
      </div>
    </div>
  );
}
