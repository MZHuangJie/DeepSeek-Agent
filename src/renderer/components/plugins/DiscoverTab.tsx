import React, { useEffect, useState } from 'react';
import { usePluginStore } from '../../stores/plugin';

export default function DiscoverTab() {
  const { discoveredPlugins, installPlugin, discoverPlugins, discoverLoading, installLoading, marketplaces, installedPlugins } = usePluginStore();
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (marketplaces.length > 0 && discoveredPlugins.length === 0) {
      discoverPlugins();
    }
  }, [marketplaces]);

  const filtered = discoveredPlugins.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase())
  );

  const isInstalled = (name: string) => installedPlugins.some(p => p.name === name);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <input
          placeholder="搜索插件..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
            color: 'var(--text-primary)', padding: '6px 10px', borderRadius: 4, fontSize: 13, outline: 'none',
          }}
        />
        <button
          onClick={discoverPlugins}
          disabled={discoverLoading || marketplaces.length === 0}
          style={{
            padding: '6px 12px', background: 'var(--accent)', border: 'none',
            color: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 12,
            opacity: discoverLoading ? 0.6 : 1,
          }}
        >
          {discoverLoading ? '刷新中...' : '⟳ 刷新'}
        </button>
      </div>

      {marketplaces.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>尚未添加插件源</div>
          <div style={{ fontSize: 12 }}>切换到 <b>Marketplaces</b> 标签页添加 GitHub 仓库作为插件源</div>
        </div>
      )}

      {marketplaces.length > 0 && filtered.length === 0 && !discoverLoading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
          {search ? '没有匹配的插件' : '该源中没有发现插件'}
        </div>
      )}

      {discoverLoading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>正在搜索插件...</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.map(p => (
          <div key={p.name} style={{
            padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: 6,
            border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.description}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.6, marginTop: 2 }}>
                {p.source}
              </div>
            </div>
            {isInstalled(p.name) ? (
              <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600, flexShrink: 0 }}>已安装</span>
            ) : (
              <button
                onClick={() => installPlugin(p)}
                disabled={installLoading[p.name]}
                style={{
                  padding: '4px 12px', background: 'var(--accent)', border: 'none',
                  color: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 11, flexShrink: 0,
                  opacity: installLoading[p.name] ? 0.6 : 1,
                }}
              >
                {installLoading[p.name] ? '安装中...' : '安装'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
