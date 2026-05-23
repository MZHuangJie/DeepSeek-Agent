import React, { useState } from 'react';
import { usePluginStore } from '../../stores/plugin';
import s from './PluginShared.module.css';

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
      <div className={s.helpText}>
        添加 GitHub 仓库作为插件源。支持 <code>owner/repo</code> 或完整 URL 格式。
      </div>

      <div className={s.addForm}>
        <input
          placeholder="例如: vercel-labs/agent-skills"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className={s.addInput}
        />
        <button
          onClick={handleAdd}
          disabled={adding || !urlInput.trim()}
          className={s.addBtn}
        >
          {adding ? '添加中...' : '+ 添加'}
        </button>
      </div>

      {marketplaces.length === 0 && (
        <div className={s.emptyHint}>暂无插件源，请添加一个</div>
      )}

      <div className={s.cardList}>
        {marketplaces.map(mp => (
          <div key={mp.id} className={s.card}>
            <div className={s.cardBody}>
              <div className={s.cardTitle}>{mp.name}</div>
              <div className={s.cardDesc}>{mp.url}</div>
            </div>
            <button onClick={() => removeMarketplace(mp.id)} className={s.removeBtn}>
              移除
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
