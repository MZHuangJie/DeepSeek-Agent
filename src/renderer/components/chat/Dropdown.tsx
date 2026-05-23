import React, { useState, useEffect, useCallback } from 'react';
import styles from '../../styles/components.module.css';

interface DropdownProps {
  position?: 'top' | 'bottom';
  maxHeight?: number;
  minWidth?: number;
  children: React.ReactNode;
  onEscape?: () => void;
}

export default function Dropdown({ position = 'top', maxHeight = 240, minWidth = 180, children, onEscape }: DropdownProps) {
  useEffect(() => {
    if (!onEscape) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onEscape(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onEscape]);

  const style: React.CSSProperties = {
    ...(position === 'top' ? { bottom: '100%', marginBottom: 4 } : { top: '100%', marginTop: 4 }),
    position: 'absolute', left: 0,
    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    borderRadius: 8, minWidth, maxHeight, overflow: 'auto',
    zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
  };
  return <div className={styles.dropdown} style={style}>{children}</div>;
}

interface DropdownItemProps {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  focused?: boolean;
}

export function DropdownItem({ active, onClick, children, focused }: DropdownItemProps) {
  return (
    <div
      onClick={onClick}
      data-dropdown-item="true"
      className={`${styles.dropdownItem} ${active ? styles.dropdownItemActive : ''}`}
      style={focused ? { background: 'var(--bg-tertiary)' } : undefined}
    >
      {children}
    </div>
  );
}

// Hook: 给 Dropdown 加 ↑↓Enter 键盘导航
export function useDropdownNav(itemCount: number, onSelect: (idx: number) => void, onClose: () => void, enabled: boolean) {
  const [focusIdx, setFocusIdx] = useState(-1);

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIdx(prev => (prev + 1) % itemCount);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIdx(prev => (prev - 1 + itemCount) % itemCount);
      } else if (e.key === 'Enter' && focusIdx >= 0) {
        e.preventDefault();
        onSelect(focusIdx);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, itemCount, focusIdx, onSelect, onClose]);

  useEffect(() => { setFocusIdx(-1); }, [itemCount, enabled]);

  return focusIdx;
}
