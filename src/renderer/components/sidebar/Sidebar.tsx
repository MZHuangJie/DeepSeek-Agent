import React from 'react';
import FileTree from './FileTree';

export default function Sidebar() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <FileTree />
      </div>
    </div>
  );
}
