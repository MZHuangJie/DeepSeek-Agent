import React from 'react';
import styles from '../../styles/components.module.css';

interface DropdownProps {
  position?: 'top' | 'bottom';
  maxHeight?: number;
  minWidth?: number;
  children: React.ReactNode;
}

export default function Dropdown({ position = 'top', maxHeight = 240, minWidth = 180, children }: DropdownProps) {
  const style: React.CSSProperties = {
    ...(position === 'top' ? { bottom: '100%', marginBottom: 4 } : { top: '100%', marginTop: 4 }),
    position: 'absolute',
    left: 0,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    minWidth,
    maxHeight,
    overflow: 'auto',
    zIndex: 100,
    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
  };
  return <div className={styles.dropdown} style={style}>{children}</div>;
}

interface DropdownItemProps {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

export function DropdownItem({ active, onClick, children }: DropdownItemProps) {
  return (
    <div
      onClick={onClick}
      className={`${styles.dropdownItem} ${active ? styles.dropdownItemActive : ''}`}
    >
      {children}
    </div>
  );
}
