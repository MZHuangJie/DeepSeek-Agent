import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useFilesStore, FileNode } from '../../stores/files';
import { getFileIconInfo } from '../../utils/icons';

interface Props {
  onClose: () => void;
}

function flattenTree(nodes: FileNode[]): FileNode[] {
  const result: FileNode[] = [];
  const walk = (list: FileNode[]) => {
    for (const n of list) {
      if (!n.isDirectory) result.push(n);
      if (n.children) walk(n.children);
    }
  };
  walk(nodes);
  return result;
}

function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  let score = 0;
  // 连续匹配加分
  let consecutive = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++;
      consecutive++;
      score += consecutive * 2;
    } else {
      consecutive = 0;
    }
  }
  return qi === q.length ? score : -1;
}

function highlightMatch(text: string, query: string): React.ReactNode[] {
  if (!query) return [text];
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let ti = 0, qi = 0;
  let current = '';
  while (ti < t.length) {
    if (qi < q.length && t[ti] === q[qi]) {
      if (current) { parts.push(current); current = ''; }
      parts.push(<mark key={ti} style={{ background: '#3b82f6', color: '#fff', borderRadius: 2, padding: '0 1px' }}>{text[ti]}</mark>);
      qi++;
    } else {
      current += text[ti];
    }
    ti++;
  }
  if (current) parts.push(current);
  return parts;
}

export default function QuickOpen({ onClose }: Props) {
  const { tree, openFile } = useFilesStore();
  const [query, setQuery] = useState('');
  const [focusIdx, setFocusIdx] = useState(0);
  const [hoverIdx, setHoverIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const allFiles = useMemo(() => flattenTree(tree), [tree]);

  const results = useMemo(() => {
    if (!query.trim()) return allFiles.slice(0, 20).map(f => ({ file: f, score: 0 }));
    const scored = allFiles
      .map(f => ({ file: f, score: fuzzyScore(query, f.name) }))
      .filter(r => r.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
    return scored;
  }, [allFiles, query]);

  // reset focus when results change
  useEffect(() => { setFocusIdx(0); }, [results.length]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleSelect = (idx: number) => {
    const item = results[idx];
    if (item) {
      openFile(item.file.path, item.file.name);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(focusIdx);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      display: 'flex', justifyContent: 'center', paddingTop: 32,
      background: 'rgba(0,0,0,0.15)',
    }} onClick={onClose}>
      <div style={{
        width: 520, maxHeight: 360,
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }} onClick={(e) => e.stopPropagation()}>
        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 14, opacity: 0.5 }}>&#x1F50D;</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索文件..."
            spellCheck={false}
            style={{
              flex: 1, background: 'transparent', border: 'none',
              color: 'var(--text-primary)', fontSize: 14, outline: 'none',
            }}
          />
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
          {results.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
              {query ? '未找到匹配文件' : '当前工作区无文件'}
            </div>
          ) : (
            results.map((r, i) => {
              const icon = getFileIconInfo(r.file.name);
              return (
                <div
                  key={r.file.path}
                  onClick={() => handleSelect(i)}
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(-1)}
                  style={{
                    background: i === focusIdx ? 'rgba(59,130,246,0.15)'
                      : i === hoverIdx ? 'rgba(59,130,246,0.06)' : undefined,
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '6px 14px', cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                    fontSize: 12, transition: 'background 0.1s',
                  }}
                >
                  <span style={{
                    color: icon.color, fontWeight: 700, fontSize: 11,
                    fontFamily: 'Consolas, "Courier New", monospace',
                    flexShrink: 0, width: 20, textAlign: 'center',
                  }}>{icon.text}</span>
                  <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 500 }}>{highlightMatch(r.file.name, query)}</span>
                    <span style={{ color: 'var(--text-secondary)', marginLeft: 10, fontSize: 11 }}>
                      {r.file.path}
                    </span>
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
