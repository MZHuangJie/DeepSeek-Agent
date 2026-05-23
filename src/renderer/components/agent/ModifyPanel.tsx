import React from 'react';
import { useAgentStore, ToolCallEntry } from '../../stores/agent';
import { useFilesStore } from '../../stores/files';

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
  const { openFile } = useFilesStore();
  const changes = extractChanges(toolCalls);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 12px', fontWeight: 600, fontSize: 12, borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        文件修改
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {changes.length === 0 && (
          <div style={{ padding: 16, fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>暂无文件修改记录</div>
        )}
        {changes.map((c, i) => {
          const color = c.type === 'A' ? '#22c55e' : c.type === 'D' ? '#ef4444' : '#ffb74d';
          const name = c.path.split(/[\\/]/).pop() || c.path;
          return (
            <div key={i} onClick={() => openFile(c.path, name)}
              style={{
                padding: '6px 12px', cursor: 'pointer', fontSize: 11,
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <span style={{ color, fontWeight: 700, width: 16, textAlign: 'center', flexShrink: 0 }}>{c.type}</span>
              <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 9, marginLeft: 'auto', flexShrink: 0 }}>{new Date(c.timestamp).toLocaleTimeString()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
