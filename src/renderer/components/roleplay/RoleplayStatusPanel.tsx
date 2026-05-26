import React, { useEffect, useMemo, useState } from 'react';
import {
  formatStatusValue,
  getStatusFieldKey,
  resolveStatusValue,
  type StatusFieldDef,
} from '../../utils/roleplay';
import styles from './RoleplayStatusPanel.module.css';

const ICONS: Record<string, string> = {
  heart: '♥',
  pulse: '💓',
  trust: '🤝',
  情绪: '♥',
  心率: '💓',
  信任值: '🤝',
};

interface Props {
  status: Record<string, unknown>;
  fieldDefs: StatusFieldDef[];
  portraitPath?: string;
}

function PortraitImage({ path }: { path?: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setSrc(null);
      return;
    }
    let cancelled = false;
    void window.api.files.readBinary(path).then(url => {
      if (!cancelled) setSrc(url);
    }).catch(() => {
      if (!cancelled) setSrc(null);
    });
    return () => { cancelled = true; };
  }, [path]);

  return (
    <div className={styles.portraitWrap}>
      {src ? (
        <img src={src} alt="" className={styles.portraitImg} />
      ) : (
        <div className={styles.portraitPlaceholder}>RP</div>
      )}
    </div>
  );
}

function formatFieldValue(field: StatusFieldDef, value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  if (field.type === 'list' && Array.isArray(value)) {
    return value.map(String).join('、');
  }
  if (field.type === 'number' && typeof value === 'number') {
    if (field.label === '心率') return `${value} bpm`;
    return String(value);
  }
  return formatStatusValue(value);
}

function renderListItems(field: StatusFieldDef, status: Record<string, unknown>): string[] {
  const value = resolveStatusValue(status, field);
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value];
  return [];
}

function buildCollapsedSummary(
  stateTags: Array<{ field: StatusFieldDef; value: string }>,
  clothingCount: number,
): string {
  const parts: string[] = [];
  if (stateTags.length > 0) {
    parts.push(stateTags.slice(0, 2).map(t => `${t.field.label} ${t.value}`).join(' · '));
  }
  if (clothingCount > 0) parts.push(`服装 ${clothingCount} 项`);
  return parts.join(' · ') || '角色状态';
}

export default function RoleplayStatusPanel({ status, fieldDefs, portraitPath }: Props) {
  const [expanded, setExpanded] = useState(true);

  const grouped = useMemo(() => {
    const clothing = fieldDefs.filter(f => f.section === 'clothing');
    const state = fieldDefs.filter(f => f.section === 'state');
    const monologue = fieldDefs.filter(f => f.section === 'monologue');
    return { clothing, state, monologue };
  }, [fieldDefs]);

  const stateTags = grouped.state
    .map(field => {
      const value = formatFieldValue(field, resolveStatusValue(status, field));
      if (!value) return null;
      return { field, value };
    })
    .filter(Boolean) as Array<{ field: StatusFieldDef; value: string }>;

  const clothingSections = grouped.clothing
    .map(field => ({
      field,
      items: renderListItems(field, status),
    }))
    .filter(s => s.items.length > 0);

  const monologueSections = grouped.monologue
    .map(field => ({
      field,
      text: formatFieldValue(field, resolveStatusValue(status, field)),
    }))
    .filter(s => s.text);

  const clothingCount = clothingSections.reduce((n, s) => n + s.items.length, 0);

  if (stateTags.length === 0 && clothingSections.length === 0 && monologueSections.length === 0) {
    return null;
  }

  const collapsedSummary = buildCollapsedSummary(stateTags, clothingCount);

  if (!expanded) {
    return (
      <div className={styles.panel}>
        <div className={styles.collapsedBar}>
          <div className={styles.portraitWrapCompact}>
            <PortraitImage path={portraitPath} />
          </div>
          <span className={styles.collapsedHint}>{collapsedSummary}</span>
          <button
            type="button"
            className={styles.collapseBtn}
            title="展开"
            onClick={() => setExpanded(true)}
          >
            展开
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <PortraitImage path={portraitPath} />
        <div className={styles.headerMain}>
          <div className={styles.headerTop}>
            <span className={styles.panelTitle}>角色状态</span>
            <button
              type="button"
              className={styles.collapseBtn}
              title="收起"
              onClick={() => setExpanded(false)}
            >
              收起
            </button>
          </div>
          {stateTags.length > 0 && (
            <div className={styles.statGrid}>
              {stateTags.map(({ field, value }) => (
                <div key={getStatusFieldKey(field)} className={styles.statCard}>
                  <span className={styles.statLabel}>
                    <span className={styles.statIcon}>
                      {ICONS[field.icon || ''] || ICONS[field.label] || '◆'}
                    </span>
                    {field.label}
                  </span>
                  <span className={styles.statValue}>{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.body}>
        {clothingSections.map(({ field, items }) => (
          <div key={getStatusFieldKey(field)} className={styles.section}>
            <div className={styles.sectionTitle}>{field.label}</div>
            <div className={styles.clothingList}>
              {items.map(item => (
                <div key={item} className={styles.clothingItem}>{item}</div>
              ))}
            </div>
          </div>
        ))}

        {monologueSections.map(({ field, text }) => (
          <div key={getStatusFieldKey(field)} className={styles.section}>
            <div className={styles.sectionTitle}>{field.label}</div>
            <blockquote className={styles.monologueBlock}>
              {text}
            </blockquote>
          </div>
        ))}
      </div>
    </div>
  );
}
