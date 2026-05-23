import React, { useState } from 'react';
import { useAgentStore, ToolCallEntry } from '../../stores/agent';
import { useFilesStore } from '../../stores/files';

interface FileChange {
  path: string;
  type: 'A' | 'M' | 'D';
  toolCallId: string;
  timestamp: number;
  diff: string;
}

function buildDiff(tc: ToolCallEntry): string {
  try {
    const args = JSON.parse(tc.args || '{}');
    if (tc.name === 'write_file') {
      return `+ 新增文件: ${args.path || '?'}\n\n${args.content || ''}`;
    }
    if (tc.name === 'edit_file') {
      const old = args.old_string || '';
      const nw = args.new_string || '';
      const oldLines = old.split('\n');
      const newLines = nw.split('\n');
      let diff = `- ${oldLines.length > 3 ? oldLines.slice(0, 3).join('\n- ') + '\n- ...' : oldLines.map((l: string) => '- ' + l).join('\n')}\n`;
      diff += `+ ${newLines.length > 3 ? newLines.slice(0, 3).join('\n+ ') + '\n+ ...' : newLines.map((l: string) => '+ ' + l).join('\n')}`;
      return diff;
    }
    if (tc.name === 'bash') return `$ ${args.command || '?'}`;
  } catch {}
  return tc.args || '';
}

function extractChanges(toolCalls: ToolCallEntry[]): FileChange[] {
  const changes: FileChange[] = [];
  const seen = new Set<string>();
  for (const tc of toolCalls) {
    if (tc.status !== 'success') continue;
    let path = '';
    try { path = JSON.parse(tc.args || '{}').path || ''; } catch {}

    if (!path) continue;
    if (seen.has(path + tc.name)) continue;
    seen.add(path + tc.name);

    let type: FileChange['type'] = 'M';
    switch (tc.name) {
      case 'write_file': type = 'A'; break;
      case 'edit_file': type = 'M'; break;
      case 'bash':
        if (tc.result?.includes('rm ') || tc.result?.includes('删除') || tc.result?.includes('unlink')) type = 'D';
        else continue;
        break;
      default: continue;
    }
    changes.push({ path, type, toolCallId: tc.id, timestamp: tc.timestamp, diff: buildDiff(tc) });
  }
  return changes;
}

export default function ModifyPanel() {
  const { toolCalls } = useAgentStore();
  const { openFile } = useFilesStore();
  const changes = extractChanges(toolCalls);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (i: number) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(i) ? next.delete(i) : next.add(i);
    return next;
  });

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
          const open = expanded.has(i);
          return (
            <div key={i}>
              <div onClick={() => toggle(i)}
                style={{
                  padding: '6px 12px', cursor: 'pointer', fontSize: 11,
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: open ? 'var(--bg-tertiary)' : 'transparent',
                }}
              >
                <span style={{ fontSize: 9 }}>{open ? '▼' : '▶'}</span>
                <span style={{ color, fontWeight: 700, width: 16, textAlign: 'center', flexShrink: 0 }}>{c.type}</span>
                <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
                  onClick={(e) => { e.stopPropagation(); openFile(c.path, name); }}
                  title="点击在编辑器中打开">{name}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: 9, flexShrink: 0 }}>{new Date(c.timestamp).toLocaleTimeString()}</span>
              </div>
              {open && (
                <pre style={{
                  margin: 0, padding: '6px 12px 6px 44px', fontSize: 10, fontFamily: 'Consolas, monospace',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--text-secondary)',
                  background: 'var(--bg-primary)', borderBottom: '1px solid rgba(255,255,255,0.03)',
                  maxHeight: 200, overflow: 'auto',
                }}>
                  {c.diff}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
