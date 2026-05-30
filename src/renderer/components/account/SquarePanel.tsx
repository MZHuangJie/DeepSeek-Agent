import React, { useEffect, useMemo, useState } from 'react';
import { useSquareStore, type SquareCharacter, type SquareModel } from '../../stores/square';
import styles from './SquarePanel.module.css';

/* ── localStorage favorites ── */
function getFavIds(): Set<string> {
  try {
    const raw = localStorage.getItem('square:favorites');
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}
function setFavIds(ids: Set<string>) {
  localStorage.setItem('square:favorites', JSON.stringify([...ids]));
}

/* ── fake heat for demo (stable per id) ── */
function getHeat(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return 1000 + (hash % 15000);
}
function fmtHeat(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

/* ── extract tags from character ── */
function getTags(c: SquareCharacter): string[] {
  const tags: string[] = [];
  if (c.gender) tags.push(c.gender);
  if (c.occupation) tags.push(c.occupation);
  // try parse personality comma-separated
  if (c.personality) {
    c.personality.split(/[,，、]/).map(s => s.trim()).filter(Boolean).forEach(t => {
      if (!tags.includes(t)) tags.push(t);
    });
  }
  return tags.slice(0, 3);
}

function CharacterCard({ item, fav, onToggleFav }: { item: SquareCharacter; fav: boolean; onToggleFav: () => void }) {
  const heat = getHeat(item.id);
  const tags = getTags(item);
  return (
    <div className={styles.characterCard}>
      {item.portraitBase64 ? (
        <div className={styles.portraitBg} style={{ backgroundImage: `url(${item.portraitBase64})` }} />
      ) : (
        <div className={styles.portraitBgEmpty}>
          <span className={styles.portraitPlaceholder}>{item.name.charAt(0) || '?'}</span>
        </div>
      )}

      {/* top-left heat */}
      <div className={styles.heatBadge}>🔥 {fmtHeat(heat)}</div>

      {/* top-right bookmark */}
      <button
        type="button"
        className={`${styles.bookmarkBtn} ${fav ? styles.bookmarkActive : ''}`}
        onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
        title={fav ? '取消收藏' : '收藏'}
      >
        {fav ? '🔖' : '🔖'}
      </button>

      <div className={styles.cardOverlay}>
        <div className={styles.cardInfo}>
          <div className={styles.cardName}>{item.name}</div>
          <div className={styles.cardUser}>by {item.userName}</div>
          {item.personality && (
            <div className={styles.cardDesc}>{item.personality}</div>
          )}
          <div className={styles.cardTags}>
            {tags.map(t => (
              <span key={t} className={styles.cardTag}>{t}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ModelItem({ item }: { item: SquareModel }) {
  return (
    <div className={styles.modelItem}>
      <div className={styles.modelInfo}>
        <div className={styles.modelName}>{item.name}</div>
        <div className={styles.modelMeta}>
          <span className={styles.modelProvider}>{item.provider}</span>
          <span>{item.modelId}</span>
          {item.contextWindow > 0 && <span>{item.contextWindow >= 1000 ? `${(item.contextWindow / 1000).toFixed(0)}K` : item.contextWindow} ctx</span>}
        </div>
      </div>
      <div className={styles.modelUser}>by {item.userName}</div>
    </div>
  );
}

export default function SquarePanel() {
  const {
    characters, models, loading, error,
    loadCharacters, loadModels, clearError,
  } = useSquareStore();
  const [tab, setTab] = useState<'characters' | 'models'>('characters');

  /* search & filters */
  const [query, setQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | '男' | '女'>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'hottest'>('newest');

  /* favorites */
  const [favIds, setFavIds] = useState<Set<string>>(getFavIds);

  useEffect(() => {
    clearError();
    void loadCharacters();
    void loadModels();
  }, []);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    characters.forEach(c => getTags(c).forEach(t => set.add(t)));
    return ['all', ...Array.from(set)];
  }, [characters]);

  const filteredCharacters = useMemo(() => {
    let list = [...characters];

    // search
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.personality?.toLowerCase().includes(q) ?? false) ||
        (c.background?.toLowerCase().includes(q) ?? false) ||
        (c.occupation?.toLowerCase().includes(q) ?? false)
      );
    }

    // gender
    if (genderFilter !== 'all') {
      list = list.filter(c => c.gender === genderFilter);
    }

    // tag
    if (tagFilter !== 'all') {
      list = list.filter(c => getTags(c).includes(tagFilter));
    }

    // sort
    if (sortBy === 'hottest') {
      list.sort((a, b) => getHeat(b.id) - getHeat(a.id));
    } else {
      list.sort((a, b) => b.updatedAt - a.updatedAt);
    }

    return list;
  }, [characters, query, genderFilter, tagFilter, sortBy]);

  const toggleFav = (id: string) => {
    const next = new Set(favIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setFavIds(next);
    setFavIds(next);
  };

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>角色广场</h1>
        <div className={styles.headerRight}>
          <div className={styles.searchBox}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder={tab === 'characters' ? '搜索角色名称、标签或描述…' : '搜索模型名称或提供商…'}
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <span className={styles.searchIcon}>🔍</span>
          </div>
        </div>
      </div>

      {/* Tabs + Filters */}
      <div className={styles.toolbarRow}>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tabBtn} ${tab === 'characters' ? styles.tabActive : ''}`}
            onClick={() => { setTab('characters'); setQuery(''); }}
          >
            角色
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${tab === 'models' ? styles.tabActive : ''}`}
            onClick={() => { setTab('models'); setQuery(''); }}
          >
            模型
          </button>
        </div>

        {tab === 'characters' && (
          <div className={styles.filters}>
            <select
              className={styles.filterSelect}
              value={genderFilter}
              onChange={e => setGenderFilter(e.target.value as any)}
            >
              <option value="all">全部性别</option>
              <option value="男">男</option>
              <option value="女">女</option>
            </select>
            <select
              className={styles.filterSelect}
              value={tagFilter}
              onChange={e => setTagFilter(e.target.value)}
            >
              {allTags.map(t => (
                <option key={t} value={t}>{t === 'all' ? '全部标签' : t}</option>
              ))}
            </select>
            <select
              className={styles.filterSelect}
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
            >
              <option value="newest">最新发布</option>
              <option value="hottest">最热</option>
            </select>
          </div>
        )}
      </div>

      {/* Body */}
      <div className={styles.body}>
        {error && <div className={styles.error}>{error}</div>}
        {loading && <div className={styles.loading}>加载中…</div>}

        {tab === 'characters' && !loading && (
          filteredCharacters.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🏪</div>
              <div className={styles.emptyTitle}>没有找到角色</div>
              <div>试试调整搜索条件或筛选器</div>
            </div>
          ) : (
            <div className={styles.characterGrid}>
              {filteredCharacters.map(c => (
                <CharacterCard
                  key={c.id}
                  item={c}
                  fav={favIds.has(c.id)}
                  onToggleFav={() => toggleFav(c.id)}
                />
              ))}
            </div>
          )
        )}

        {tab === 'models' && !loading && (
          models.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🔌</div>
              <div className={styles.emptyTitle}>广场暂无模型</div>
              <div>还没有用户分享模型到广场</div>
            </div>
          ) : (
            <div className={styles.modelList}>
              {models.map(m => (
                <ModelItem key={m.id} item={m} />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
