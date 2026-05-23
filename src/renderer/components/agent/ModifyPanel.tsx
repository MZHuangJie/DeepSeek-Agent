import React, { useState } from 'react';
import { useAgentStore, ToolCallEntry } from '../../stores/agent';
import { useFilesStore } from '../../stores/files';
import styles from './ModifyPanel.module.css';

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
    <div className={styles.container}>
      <div className={styles.header}>文件修改</div>
      <div className={styles.list}>
        {changes.length === 0 && (
          <div className={styles.empty}>暂无文件修改记录</div>
        )}
        {changes.map((c, i) => {
          const color = c.type === 'A' ? '#22c55e' : c.type === 'D' ? '#ef4444' : '#ffb74d';
          const name = c.path.split(/[\\/]/).pop() || c.path;
          const open = expanded.has(i);
          return (
            <div key={i}>
              <div onClick={() => toggle(i)}
                className={`${styles.row} ${open ? styles.rowOpen : ''}`}
              >
                <span className={styles.caret}>{open ? '▼' : '▶'}</span>
                <span className={styles.typeTag} style={{ color }}>{c.type}</span>
                <span className={styles.fileName}
                  onClick={(e) => { e.stopPropagation(); openFile(c.path, name); }}
                  title="点击在编辑器中打开">{name}</span>
                <span className={styles.fileTime}>{new Date(c.timestamp).toLocaleTimeString()}</span>
              </div>
              {open && (
                <pre className={styles.diff}>{c.diff}</pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
