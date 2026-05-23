import React, { useEffect, useState } from 'react';
import { usePluginStore } from '../../stores/plugin';
import s from './PluginShared.module.css';

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
      <div className={s.toolbar}>
        <input
          placeholder="搜索插件..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={s.searchInput}
        />
        <button
          onClick={discoverPlugins}
          disabled={discoverLoading || marketplaces.length === 0}
          className={s.actionBtn}
        >
          {discoverLoading ? '刷新中...' : '⟳ 刷新'}
        </button>
      </div>

      {marketplaces.length === 0 && (
        <div className={s.emptyHint}>
          <div className={s.emptyTitle}>尚未添加插件源</div>
          <div className={s.emptyDesc}>切换到 <b>Marketplaces</b> 标签页添加 GitHub 仓库作为插件源</div>
        </div>
      )}

      {marketplaces.length > 0 && filtered.length === 0 && !discoverLoading && (
        <div className={s.emptyHint}>
          {search ? '没有匹配的插件' : '该源中没有发现插件'}
        </div>
      )}

      {discoverLoading && (
        <div className={s.loading}>正在搜索插件...</div>
      )}

      <div className={s.cardList}>
        {filtered.map(p => (
          <div key={p.name} className={s.card}>
            <div className={s.cardBody}>
              <div className={s.cardTitle}>{p.name}</div>
              <div className={s.cardDesc}>{p.description}</div>
              <div className={s.cardMeta}>{p.source}</div>
            </div>
            {isInstalled(p.name) ? (
              <span className={s.installedBadge}>已安装</span>
            ) : (
              <button
                onClick={() => installPlugin(p)}
                disabled={installLoading[p.name]}
                className={s.installBtn}
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
