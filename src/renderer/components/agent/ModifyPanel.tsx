import React, { useState } from 'react';
import { useAgentStore, ToolCallEntry } from '../../stores/agent';

interface FileChange {
  path: string;
  type: 'A' | 'M' | 'D'; // Added, Modified, Deleted
  toolCallId: string;
  timestamp: number;
}

function extractChanges(toolCalls: ToolCallEntry[]): FileChange[] {
  const changes: FileChange[] = [];
  const seen = new Set<string>();
  for (const tc of toolCalls) {
    if (tc.status !== 'success') continue;
    let path = '';
    let type: FileChange['type'] = 'M';
    try {
      const args = JSON.parse(tc.args || '{}');
      path = args.path || args.filePath || args.target || '';
    } catch {}

    if (!path) continue;
    if (seen.has(path + tc.name)) continue;
    seen.add(path + tc.name);

    switch (tc.name) {
      case 'write_file': type = 'A'; break;
      case 'edit_file': type = 'M'; break;
      case 'bash':
        if (tc.result?.includes('rm ') || tc.result?.includes('删除') || tc.result?.includes('unlink')) type = 'D';
        else continue;
        break;
      default: continue;
    }
    changes.push({ path, type, toolCallId: tc.id, timestamp: tc.timestamp });
  }
  return changes;
}

export default function ModifyPanel() {
  const { toolCalls } = useAgentStore();
  const changes = extractChanges(toolCalls);
  const [selectedChange, setSelectedChange] = useState<FileChange | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);

  const handleClick = async (change: FileChange) => {
    setSelectedChange(change);
    try {
      const content = await window.api.files.read(change.path);
      setFileContent(content);
    } catch {
      setFileContent('无法读取文件内容');
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 12px', fontWeight: 600, fontSize: 12, borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        文件修改
      </div>

      {/* File list */}
      <div style={{ flex: changes.length > 0 && !selectedChange ? 1 : 'none', overflow: 'auto' }}>
        {changes.length === 0 && (
          <div style={{ padding: 16, fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>暂无文件修改记录</div>
        )}
        {changes.map((c, i) => {
          const color = c.type === 'A' ? '#22c55e' : c.type === 'D' ? '#ef4444' : '#ffb74d';
          const name = c.path.split(/[\\/]/).pop() || c.path;
          return (
            <div key={i} onClick={() => handleClick(c)}
              style={{
                padding: '6px 12px', cursor: 'pointer', fontSize: 11,
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', gap: 8,
                background: selectedChange?.path === c.path ? 'var(--bg-tertiary)' : 'transparent',
              }}
            >
              <span style={{ color, fontWeight: 700, width: 16, textAlign: 'center', flexShrink: 0 }}>{c.type}</span>
              <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 9, marginLeft: 'auto', flexShrink: 0 }}>{new Date(c.timestamp).toLocaleTimeString()}</span>
            </div>
          );
        })}
      </div>

      {/* File content preview */}
      {selectedChange && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderTop: '1px solid var(--border)' }}>
          <div style={{ padding: '6px 10px', fontSize: 11, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span onClick={() => setSelectedChange(null)} style={{ cursor: 'pointer' }}>✕</span>
            <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{selectedChange.path.split(/[\\/]/).pop() || selectedChange.path}</span>
            <span style={{ color: selectedChange.type === 'A' ? '#22c55e' : '#ffb74d', fontWeight: 700, marginLeft: 'auto' }}>{selectedChange.type}</span>
          </div>
          <pre style={{
            flex: 1, margin: 0, padding: '8px 12px',
            fontSize: 11, fontFamily: 'Consolas, monospace',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            overflow: 'auto', color: 'var(--text-primary)',
            background: 'var(--bg-primary)',
          }}>
            {fileContent || '加载中...'}
          </pre>
        </div>
      )}
    </div>
  );
}
