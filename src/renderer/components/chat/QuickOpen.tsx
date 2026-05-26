import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useFilesStore, FileNode } from '../../stores/files';
import { getFileIconInfo } from '../../utils/icons';
import { useFocusedItemRef } from './Dropdown';
import {
  SEARCH_FILTERS,
  SearchFilter,
  searchWorkspace,
  relativeWorkspacePath,
  loadRecentSearches,
  saveRecentSearches,
  pushRecentSearch,
  fuzzyScore,
} from './quickOpenSearch';
import styles from './QuickOpen.module.css';

interface Props {
  onClose: () => void;
}

function highlightMatch(text: string, query: string): React.ReactNode[] {
  if (!query.trim() || query.includes('*') || query.includes('?')) return [text];
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let ti = 0;
  let qi = 0;
  let current = '';
  while (ti < t.length) {
    if (qi < q.length && t[ti] === q[qi]) {
      if (current) {
        parts.push(current);
        current = '';
      }
      parts.push(
        <mark key={`${ti}-${qi}`}>{text[ti]}</mark>,
      );
      qi++;
    } else {
      current += text[ti];
    }
    ti++;
  }
  if (current) parts.push(current);
  return parts.length > 0 ? parts : [text];
}

function FilterIcon({ type }: { type: SearchFilter }) {
  const common = { className: styles.filterIcon, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 };
  switch (type) {
    case 'all':
      return (
        <svg {...common}>
          <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" strokeLinecap="round" />
          <rect x="2" y="2.5" width="12" height="11" rx="2" />
        </svg>
      );
    case 'file':
      return (
        <svg {...common}>
          <path d="M4.5 2.5h4l3 3v8.5h-7v-11.5z" />
          <path d="M8.5 2.5v3h3" />
        </svg>
      );
    case 'folder':
      return (
        <svg {...common}>
          <path d="M2.5 4.5h4l1.5 1.5h5.5v7h-11v-8.5z" />
        </svg>
      );
    case 'code':
      return (
        <svg {...common}>
          <path d="M5 5.5 2.5 8 5 10.5M11 5.5 13.5 8 11 10.5M9 3.5 7 12.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'image':
      return (
        <svg {...common}>
          <rect x="2.5" y="3.5" width="11" height="9" rx="1.5" />
          <circle cx="6" cy="7" r="1.2" />
          <path d="M3.5 11.5l3-2.5 2.5 2 2-1.5 2.5 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'document':
      return (
        <svg {...common}>
          <path d="M4.5 2.5h4l3 3v8.5h-7v-11.5z" />
          <path d="M6.5 8.5h3M6.5 10.5h3" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

function SearchGlyph() {
  return (
    <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4.2-4.2" strokeLinecap="round" />
    </svg>
  );
}

function ResultRow({
  node,
  query,
  workspace,
  focused,
  onClick,
}: {
  node: FileNode;
  query: string;
  workspace: string | null;
  focused: boolean;
  onClick: () => void;
}) {
  const ref = useFocusedItemRef(focused);
  const icon = node.isDirectory
    ? { text: '📁', color: '#c4b5fd' }
    : getFileIconInfo(node.name);

  return (
    <div
      ref={ref}
      className={`${styles.resultItem} ${focused ? styles.resultItemFocused : ''}`}
      onClick={onClick}
    >
      <div
        className={`${styles.fileIcon} ${node.isDirectory ? styles.folderIconBadge : ''}`}
        style={node.isDirectory ? undefined : { color: icon.color, background: `${icon.color}22` }}
      >
        {icon.text}
      </div>
      <div className={styles.resultMain}>
        <div className={styles.resultName}>{highlightMatch(node.name, query)}</div>
        <div className={styles.resultPath}>{relativeWorkspacePath(node.path, workspace)}</div>
      </div>
      <span className={styles.resultKind}>{node.isDirectory ? '文件夹' : '文件'}</span>
    </div>
  );
}

export default function QuickOpen({ onClose }: Props) {
  const { tree, openFile, currentWorkspace } = useFilesStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchFilter>('all');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [focusIdx, setFocusIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(
    () => searchWorkspace(tree, query, filter),
    [tree, query, filter],
  );

  useEffect(() => {
    loadRecentSearches().then(setRecentSearches);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    setFocusIdx(0);
  }, [results.length, query, filter]);

  const commitSearch = useCallback(async (term: string) => {
    const next = await pushRecentSearch(term);
    setRecentSearches(next);
  }, []);

  const handleSelect = useCallback(async (node: FileNode) => {
    if (query.trim()) await commitSearch(query);
    if (node.isDirectory) {
      await window.api.files.showInExplorer(node.path);
    } else {
      await openFile(node.path, node.name);
    }
    onClose();
  }, [commitSearch, onClose, openFile, query]);

  const handleSelectIndex = useCallback((idx: number) => {
    const item = results[idx];
    if (item) void handleSelect(item.node);
  }, [handleSelect, results]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length > 0) setFocusIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length > 0) setFocusIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results.length > 0) {
        handleSelectIndex(focusIdx);
      }
    } else if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const idx = SEARCH_FILTERS.findIndex(item => item.id === filter);
      const next = e.shiftKey
        ? (idx - 1 + SEARCH_FILTERS.length) % SEARCH_FILTERS.length
        : (idx + 1) % SEARCH_FILTERS.length;
      setFilter(SEARCH_FILTERS[next].id);
    }
  };

  const clearRecent = async () => {
    await saveRecentSearches([]);
    setRecentSearches([]);
  };

  const applyRecent = (term: string) => {
    setQuery(term);
    inputRef.current?.focus();
  };

  const hasQuery = query.trim().length > 0;

  return (
    <div className={styles.overlay} data-focus-guard onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.searchIconWrap}>
            <SearchGlyph />
          </div>
          <div className={styles.inputArea}>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="搜索文件..."
              spellCheck={false}
              className={styles.input}
            />
            <div className={styles.subtitle}>搜索当前工作区的文件和目录</div>
          </div>
          <div className={styles.shortcut}>
            <span className={styles.kbd}>Ctrl</span>
            <span className={styles.kbd}>P</span>
          </div>
        </div>

        <div className={styles.filters}>
          {SEARCH_FILTERS.map(item => (
            <button
              key={item.id}
              type="button"
              className={`${styles.filterBtn} ${filter === item.id ? styles.filterBtnActive : ''}`}
              onClick={() => setFilter(item.id)}
            >
              <FilterIcon type={item.id} />
              {item.label}
            </button>
          ))}
        </div>

        <div className={styles.body}>
          {!hasQuery && recentSearches.length > 0 && (
            <div className={styles.recentSection}>
              <div className={styles.recentHeader}>
                <span className={styles.recentTitle}>最近搜索</span>
                <button type="button" className={styles.clearBtn} onClick={() => void clearRecent()}>
                  <span aria-hidden>🗑</span>
                  清除历史
                </button>
              </div>
              <div className={styles.recentList}>
                {recentSearches.map(term => (
                  <button
                    key={term}
                    type="button"
                    className={styles.recentChip}
                    onClick={() => applyRecent(term)}
                  >
                    <span aria-hidden>🕘</span>
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!hasQuery ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIllustration}>
                <span className={`${styles.sparkle} ${styles.sparkleOne}`}>✦</span>
                <span className={`${styles.sparkle} ${styles.sparkleTwo}`}>✦</span>
                <div className={styles.folderTab} />
                <div className={styles.folderShape} />
                <div className={styles.magnifier} />
              </div>
              <div className={styles.emptyTitle}>开始搜索文件</div>
              <div className={styles.emptyDesc}>
                输入关键词搜索文件、文件夹或代码，支持模糊匹配
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className={styles.noResults}>未找到匹配项，试试调整关键词或切换筛选类型</div>
          ) : (
            <div className={styles.results}>
              {results.map((item, index) => (
                <ResultRow
                  key={item.node.path}
                  node={item.node}
                  query={query}
                  workspace={currentWorkspace}
                  focused={index === focusIdx}
                  onClick={() => void handleSelect(item.node)}
                />
              ))}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <span className={styles.footerIcon}>💡</span>
          <span>提示：使用通配符 * 匹配任意字符，使用 ? 匹配单个字符</span>
        </div>
      </div>
    </div>
  );
}
