import React, { useState } from 'react';
import { usePluginStore } from '../../stores/plugin';

export default function MarketplacesTab() {
  const { marketplaces, addMarketplace, removeMarketplace, discoverPlugins, discoverLoading } = usePluginStore();
  const [urlInput, setUrlInput] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!urlInput.trim()) return;
    setAdding(true);
    try {
      await addMarketplace(urlInput.trim());
      setUrlInput('');
    } catch (err: any) {
      alert(err.message || '添加失败');
    }
    setAdding(false);
  };

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
        添加 GitHub 仓库作为插件源。支持 <code>owner/repo</code> 或完整 URL 格式。
      </div>

      {/* Add form */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          placeholder="例如: vercel-labs/agent-skills"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          style={{
            flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
            color: 'var(--text-primary)', padding: '7px 10px', borderRadius: 4, fontSize: 13, outline: 'none',
          }}
        />
        <button
          onClick={handleAdd}
          disabled={adding || !urlInput.trim()}
          style={{
            padding: '7px 16px', background: 'var(--accent)', border: 'none',
            color: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 12,
            opacity: adding ? 0.6 : 1, whiteSpace: 'nowrap',
          }}
        >
          {adding ? '添加中...' : '+ 添加'}
        </button>
      </div>

      {/* List */}
      {marketplaces.length === 0 && (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', fontSize: 12 }}>
          暂无插件源，请添加一个
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {marketplaces.map(mp => (
          <div key={mp.id} style={{
            padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: 6,
            border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{mp.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.6, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {mp.url}
              </div>
            </div>
            <button
              onClick={() => removeMarketplace(mp.id)}
              style={{
                padding: '4px 12px', background: 'transparent', border: '1px solid #ef4444',
                color: '#ef4444', borderRadius: 4, cursor: 'pointer', fontSize: 11, flexShrink: 0,
              }}
            >
              移除
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
