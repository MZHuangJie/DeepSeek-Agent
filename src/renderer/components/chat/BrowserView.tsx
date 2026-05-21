import React, { useState, useRef } from 'react';

export default function BrowserView() {
  const [url, setUrl] = useState('https://www.google.com');
  const [inputUrl, setInputUrl] = useState('https://www.google.com');
  const webviewRef = useRef<any>(null);

  const navigate = () => {
    const u = inputUrl.trim();
    if (!u) return;
    const fullUrl = u.startsWith('http') ? u : `https://${u}`;
    setUrl(fullUrl);
    setInputUrl(fullUrl);
  };

  const goBack = () => webviewRef.current?.goBack();
  const goForward = () => webviewRef.current?.goForward();
  const reload = () => webviewRef.current?.reload();

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Navigation Bar */}
      <div style={{
        padding: '6px 8px', borderBottom: '1px solid var(--border)',
        display: 'flex', gap: 4, alignItems: 'center', background: 'var(--bg-secondary)',
      }}>
        <NavBtn onClick={goBack} title="后退">◀</NavBtn>
        <NavBtn onClick={goForward} title="前进">▶</NavBtn>
        <NavBtn onClick={reload} title="刷新">↻</NavBtn>
        <input
          type="text"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && navigate()}
          placeholder="输入网址..."
          style={{
            flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
            borderRadius: 4, color: 'var(--text-primary)', padding: '4px 8px',
            fontSize: 11, outline: 'none',
          }}
        />
      </div>

      {/* Webview */}
      <webview
        ref={webviewRef}
        src={url}
        style={{ flex: 1, border: 'none' }}
      />
    </div>
  );
}

function NavBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
        color: 'var(--text-secondary)', borderRadius: 4,
        padding: '4px 9px', fontSize: 11, cursor: 'pointer',
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  );
}
