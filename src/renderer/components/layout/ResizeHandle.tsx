import React, { useCallback, useRef, useState } from 'react';

interface Props {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
}

export default function ResizeHandle({ direction, onResize }: Props) {
  const startRef = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startRef.current = direction === 'horizontal' ? e.clientX : e.clientY;
    setDragging(true);

    const onMouseMove = (ev: MouseEvent) => {
      const current = direction === 'horizontal' ? ev.clientX : ev.clientY;
      const delta = current - startRef.current;
      onResize(delta);
      startRef.current = current;
    };
    const onMouseUp = () => {
      setDragging(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [direction, onResize]);

  const isHorizontal = direction === 'horizontal';

  const wrapperStyle: React.CSSProperties = isHorizontal
    ? {
        width: 6,
        cursor: 'col-resize',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: dragging || hovered ? 'rgba(124,58,237,0.15)' : 'transparent',
        transition: 'background 0.15s',
        zIndex: 10,
      }
    : {
        height: 6,
        cursor: 'row-resize',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: dragging || hovered ? 'rgba(124,58,237,0.15)' : 'transparent',
        transition: 'background 0.15s',
        zIndex: 10,
      };

  const lineStyle: React.CSSProperties = isHorizontal
    ? {
        width: 2,
        height: '100%',
        background: dragging || hovered ? 'var(--accent)' : 'var(--border)',
        transition: 'background 0.15s',
      }
    : {
        height: 2,
        width: '100%',
        background: dragging || hovered ? 'var(--accent)' : 'var(--border)',
        transition: 'background 0.15s',
      };

  return (
    <div
      style={wrapperStyle}
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={lineStyle} />
    </div>
  );
}
