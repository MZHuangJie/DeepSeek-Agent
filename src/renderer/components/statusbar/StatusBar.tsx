import React, { useState } from 'react';
import { useEditorStore } from '../../stores/editor';
import shared from '../../styles/components.module.css';
import styles from './StatusBar.module.css';

interface Props {
  language: string;
}

export default function StatusBar({ language }: Props) {
  const { line, column, insertSpaces, tabSize, eol, encoding, errorCount, warningCount } = useEditorStore();
  const [indentMenuOpen, setIndentMenuOpen] = useState(false);
  const [eolMenuOpen, setEolMenuOpen] = useState(false);

  const indentText = insertSpaces ? `空格: ${tabSize}` : `制表符: ${tabSize}`;

  if (!language) return null;

  return (
    <div className={shared.statusBar}>
      <div className={styles.leftGroup}>
        <StatusItem>
          <img src="./assets/error.png" alt="errors" className={styles.statusIcon} />
          <span>{errorCount}</span>
        </StatusItem>
        <StatusItem>
          <span className={styles.warningIcon}>⚠</span>
          <span>{warningCount}</span>
        </StatusItem>
      </div>

      <div className={styles.rightGroup}>
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
          <span className={styles.languageIcon}>{'{ }'}</span>
          <span className={styles.languageLabel}>{languageLabel(language)}</span>
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
  return <div onClick={onClick} className={shared.statusItem} style={{ cursor: clickable ? 'pointer' : 'default' }}>{children}</div>;
}

function DropdownMenu({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div className={styles.dropdownOverlay} onClick={onClose} />
      <div className={styles.dropdown}>
        {children}
      </div>
    </>
  );
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <div onClick={onClick} className={shared.statusDropdown}>{children}</div>;
}
