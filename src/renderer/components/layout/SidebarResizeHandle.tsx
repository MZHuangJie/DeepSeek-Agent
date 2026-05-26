import React, { useCallback, useRef, useState } from 'react';

const COLLAPSE_DELAY_MS = 1500;

interface Props {
  width: number;
  minWidth: number;
  onWidthChange: (width: number) => void;
  onCollapse: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export default function SidebarResizeHandle({
  width,
  minWidth,
  onWidthChange,
  onCollapse,
  onDragStart,
  onDragEnd,
}: Props) {
  const startRef = useRef(0);
  const widthRef = useRef(width);
  widthRef.current = width;

  const draggingRef = useRef(false);
  const lastDeltaRef = useRef(0);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);

  const clearCollapseTimer = useCallback(() => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = undefined;
    }
  }, []);

  const scheduleCollapseCheck = useCallback(() => {
    if (collapseTimerRef.current) return;
    collapseTimerRef.current = setTimeout(() => {
      collapseTimerRef.current = undefined;
      if (!draggingRef.current) return;
      if (widthRef.current > minWidth) return;
      if (lastDeltaRef.current < 0) {
        onCollapse();
      }
    }, COLLAPSE_DELAY_MS);
  }, [minWidth, onCollapse]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startRef.current = e.clientX;
    draggingRef.current = true;
    lastDeltaRef.current = 0;
    clearCollapseTimer();
    setDragging(true);
    onDragStart?.();

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startRef.current;
      startRef.current = ev.clientX;
      lastDeltaRef.current = delta;

      const nextWidth = Math.max(minWidth, widthRef.current + delta);

      if (nextWidth > minWidth) {
        clearCollapseTimer();
        onWidthChange(nextWidth);
        return;
      }

      if (widthRef.current !== minWidth) {
        onWidthChange(minWidth);
      }

      if (delta < 0) {
        scheduleCollapseCheck();
      } else if (delta > 0) {
        clearCollapseTimer();
        onWidthChange(nextWidth);
      }
    };

    const onMouseUp = () => {
      draggingRef.current = false;
      clearCollapseTimer();
      setDragging(false);
      onDragEnd?.();
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [clearCollapseTimer, minWidth, onDragEnd, onDragStart, onWidthChange, scheduleCollapseCheck]);

  return (
    <div
      style={{
        width: 6,
        cursor: 'col-resize',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: dragging || hovered ? 'rgba(124,58,237,0.15)' : 'transparent',
        transition: dragging ? 'none' : 'background 0.15s',
        zIndex: 10,
      }}
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          width: 2,
          height: '100%',
          background: dragging || hovered ? 'var(--accent)' : 'var(--border)',
          transition: dragging ? 'none' : 'background 0.15s',
        }}
      />
    </div>
  );
}
