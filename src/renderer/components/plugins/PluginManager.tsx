import React, { useEffect } from 'react';
import { usePluginStore } from '../../stores/plugin';
import DiscoverTab from './DiscoverTab';
import InstalledTab from './InstalledTab';
import MarketplacesTab from './MarketplacesTab';
import ErrorsTab from './ErrorsTab';

interface Props {
  onClose: () => void;
}

const TABS = [
  { key: 'discover' as const, label: '🔍 Discover' },
  { key: 'installed' as const, label: '📦 Installed' },
  { key: 'marketplaces' as const, label: '🏪 Marketplaces' },
  { key: 'errors' as const, label: '⚠️ Errors' },
];

export default function PluginManager({ onClose }: Props) {
  const { activeTab, setActiveTab, loadMarketplaces, loadInstalled, loadErrors, errors } = usePluginStore();

  useEffect(() => {
    loadMarketplaces();
    loadInstalled();
    loadErrors();
  }, []);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8,
        width: 700, height: 520, display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>插件管理器</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 18 }}>
            ×
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {TABS.map(tab => (
            <div
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: activeTab === tab.key ? 600 : 400,
                color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
                background: activeTab === tab.key ? 'var(--bg-tertiary)' : 'transparent',
                transition: 'all 0.15s',
                position: 'relative',
              }}
            >
              {tab.label}
              {tab.key === 'errors' && errors.length > 0 && (
                <span style={{
                  marginLeft: 4, background: '#ef4444', color: '#fff', fontSize: 9,
                  padding: '1px 5px', borderRadius: 10, fontWeight: 700,
                }}>{errors.length}</span>
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {activeTab === 'discover' && <DiscoverTab />}
          {activeTab === 'installed' && <InstalledTab />}
          {activeTab === 'marketplaces' && <MarketplacesTab />}
          {activeTab === 'errors' && <ErrorsTab />}
        </div>
      </div>
    </div>
  );
}
