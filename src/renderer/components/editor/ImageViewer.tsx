import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from '../../styles/components.module.css';

interface Props {
  filePath: string;
}

const IMG_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico']);

export function isImageFile(name: string): boolean {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  return IMG_EXTENSIONS.has(ext);
}

const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 8];

const centerStyle: React.CSSProperties = {
  height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--text-secondary)',
};

export default function ImageViewer({ filePath }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoomIdx, setZoomIdx] = useState(-1);
  const [pressingCtrl, setPressingCtrl] = useState(false);
  const zoomRef = useRef(-1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const dataUri = await window.api.files.readBinary(filePath);
        if (!cancelled) setSrc(dataUri);
      } catch (e: any) {
        if (!cancelled) setError(e.message || String(e));
      }
    })();
    zoomRef.current = -1;
    setZoomIdx(-1);
    setError(null);
    return () => { cancelled = true; };
  }, [filePath]);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => { if (e.key === 'Control') setPressingCtrl(true); };
    const onUp = (e: KeyboardEvent) => { if (e.key === 'Control') setPressingCtrl(false); };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const ctrl = e.ctrlKey || e.metaKey;
    const maxIdx = ZOOM_LEVELS.length - 1;

    if (ctrl) {
      zoomRef.current = zoomRef.current <= 0 ? -1 : zoomRef.current - 1;
    } else if (zoomRef.current === -1) {
      zoomRef.current = 0;
    } else if (zoomRef.current < maxIdx) {
      zoomRef.current += 1;
    }
    setZoomIdx(zoomRef.current);
  }, []);

  if (error) {
    return (
      <div style={{ ...centerStyle, flexDirection: 'column', gap: 8 }}>
        <span>无法加载图片</span>
        <span style={{ fontSize: 11, opacity: 0.6 }}>{error}</span>
      </div>
    );
  }

  if (!src) {
    return <div style={centerStyle}>加载中...</div>;
  }

  const isFit = zoomIdx === -1;

  return (
    <div className={styles.imageViewer} style={{ cursor: pressingCtrl ? 'zoom-out' : 'zoom-in' }} onClick={handleClick}>
      <img
        src={src}
        alt=""
        draggable={false}
        style={{
          display: 'block',
          maxWidth: isFit ? '100%' : 'none',
          maxHeight: isFit ? '100%' : 'none',
          width: isFit ? undefined : `${ZOOM_LEVELS[zoomIdx] * 100}%`,
          height: isFit ? undefined : 'auto',
          objectFit: isFit ? 'contain' : undefined,
        }}
      />
    </div>
  );
}
