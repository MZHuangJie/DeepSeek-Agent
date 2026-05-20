import React, { useState } from 'react';
import { useEditorStore } from '../../stores/editor';

interface Props {
  language: string;
}

export default function StatusBar({ language }: Props) {
  const { line, column, insertSpaces, tabSize, eol, encoding } = useEditorStore();
  const [indentMenuOpen, setIndentMenuOpen] = useState(false);
  const [eolMenuOpen, setEolMenuOpen] = useState(false);

  const indentText = insertSpaces ? `空格: ${tabSize}` : `制表符: ${tabSize}`;

  return (
    <div style={{
      height: 22,
      background: 'var(--accent)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: 12,
      color: '#fff',
      padding: '0 8px',
      flexShrink: 0,
      userSelect: 'none',
      zIndex: 5,
    }}>
      {/* Left: errors / warnings */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <StatusItem>
          <span style={{ fontSize: 14, marginRight: 2 }}>×</span>
          <span>0</span>
        </StatusItem>
        <StatusItem>
          <span style={{ fontSize: 14, marginRight: 2 }}>⚠</span>
          <span>0</span>
        </StatusItem>
      </div>

      {/* Right: cursor, indent, encoding, eol, language */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        <StatusItem>
          <span>行 {line}, 列 {column}</span>
        </StatusItem>

        <StatusItem onClick={() => setIndentMenuOpen(!indentMenuOpen)} clickable>
          <span>{indentText}</span>
          {indentMenuOpen && (
            <DropdownMenu onClose={() => setIndentMenuOpen(false)}>
              <MenuItem onClick={() => { useEditorStore.getState().setIndent(true, 2); setIndentMenuOpen(false); }}>空格: 2</MenuItem>
              <MenuItem onClick={() => { useEditorStore.getState().setIndent(true, 4); setIndentMenuOpen(false); }}>空格: 4</MenuItem>
              <MenuItem onClick={() => { useEditorStore.getState().setIndent(false, 4); setIndentMenuOpen(false); }}>制表符: 4</MenuItem>
            </DropdownMenu>
          )}
        </StatusItem>

        <StatusItem>
          <span>{encoding}</span>
        </StatusItem>

        <StatusItem onClick={() => setEolMenuOpen(!eolMenuOpen)} clickable>
          <span>{eol}</span>
          {eolMenuOpen && (
            <DropdownMenu onClose={() => setEolMenuOpen(false)}>
              <MenuItem onClick={() => { useEditorStore.getState().setEol('LF'); setEolMenuOpen(false); }}>LF</MenuItem>
              <MenuItem onClick={() => { useEditorStore.getState().setEol('CRLF'); setEolMenuOpen(false); }}>CRLF</MenuItem>
            </DropdownMenu>
          )}
        </StatusItem>

        <StatusItem>
          <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 600 }}>{'{ }'}</span>
          <span style={{ marginLeft: 4 }}>{languageLabel(language)}</span>
        </StatusItem>
      </div>
    </div>
  );
}

function languageLabel(lang: string): string {
  const map: Record<string, string> = {
    typescript: 'TypeScript',
    javascript: 'JavaScript',
    json: 'JSON',
    markdown: 'Markdown',
    css: 'CSS',
    html: 'HTML',
    yaml: 'YAML',
    python: 'Python',
  };
  return map[lang] || lang.toUpperCase();
}

function StatusItem({ children, onClick, clickable }: { children: React.ReactNode; onClick?: () => void; clickable?: boolean }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '0 8px',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        cursor: clickable ? 'pointer' : 'default',
        position: 'relative',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => clickable && (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
      onMouseLeave={e => clickable && (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </div>
  );
}

function DropdownMenu({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
        }}
        onClick={onClose}
      />
      <div style={{
        position: 'absolute', bottom: '100%', right: 0, marginBottom: 2,
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        borderRadius: 4, minWidth: 120, padding: '2px 0',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        zIndex: 201,
      }}>
        {children}
      </div>
    </>
  );
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '4px 12px', fontSize: 12, color: 'var(--text-primary)',
        cursor: 'pointer', whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </div>
  );
}
