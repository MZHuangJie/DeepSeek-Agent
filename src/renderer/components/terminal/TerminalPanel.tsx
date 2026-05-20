import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

interface Props {
  termId: string;
}

export default function TerminalPanel({ termId }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const term = new Terminal({
      theme: { background: '#0d0d0d', foreground: '#00ff00', cursor: '#00ff00', selectionBackground: '#7c3aed' },
      fontSize: 13,
      fontFamily: 'Consolas, "Courier New", monospace',
      cursorBlink: true,
      cursorStyle: 'block',
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(ref.current);
    fitAddon.fit();
    fitRef.current = fitAddon;

    const unsub = window.api.terminal.onData(termId, (data: string) => term.write(data));
    term.onData((data: string) => window.api.terminal.write(termId, data));

    termRef.current = term;

    // ResizeObserver: fit when container size changes (drag handle, collapse, etc.)
    let ro: ResizeObserver | null = null;
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
    let lastDims = { cols: 0, rows: 0 };

    const doFit = () => {
      fitAddon.fit();
      const dims = fitAddon.proposeDimensions();
      if (dims && (dims.cols !== lastDims.cols || dims.rows !== lastDims.rows)) {
        lastDims = dims;
        window.api.terminal.resize(termId, dims.cols, dims.rows);
      }
    };

    if ('ResizeObserver' in window) {
      ro = new ResizeObserver(() => {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(doFit, 150);
      });
      ro.observe(ref.current);
    }

    const resizeHandler = () => doFit();
    window.addEventListener('resize', resizeHandler);

    return () => {
      unsub();
      window.removeEventListener('resize', resizeHandler);
      ro?.disconnect();
      if (resizeTimeout) clearTimeout(resizeTimeout);
      term.dispose();
    };
  }, [termId]);

  return <div ref={ref} style={{ height: '100%', padding: 4 }} />;
}
