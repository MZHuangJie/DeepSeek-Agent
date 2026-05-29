import React, { useState } from 'react';
import type { PlanTodo } from '../../stores/chat';
import styles from './PlanTodoPanel.module.css';

interface Props {
  todos: PlanTodo[];
  planDocPath?: string;
  executing: boolean;
  onExecute: () => void;
}

const STATUS_GLYPH: Record<PlanTodo['status'], string> = {
  pending: '○',
  in_progress: '◐',
  completed: '✓',
  cancelled: '✕',
};

export default function PlanTodoPanel({ todos, planDocPath, executing, onExecute }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  if (todos.length === 0) return null;

  const done = todos.filter(t => t.status === 'completed').length;
  const allDone = done === todos.length;

  return (
    <div className={styles.panel}>
      <div className={styles.header} onClick={() => setCollapsed(c => !c)}>
        <span className={styles.chevron}>{collapsed ? '▶' : '▼'}</span>
        <span className={styles.title}>任务清单</span>
        <span className={styles.progress}>{done}/{todos.length}</span>
        {planDocPath && <span className={styles.docPath} title={planDocPath}>{planDocPath}</span>}
        <button
          className={styles.execBtn}
          disabled={executing || allDone}
          onClick={(e) => { e.stopPropagation(); onExecute(); }}
          title={allDone ? '全部任务已完成' : '切换到 Agent 模式并逐项执行'}
        >
          {executing ? '执行中…' : allDone ? '已完成' : '▶ 执行计划'}
        </button>
      </div>
      {!collapsed && (
        <div className={styles.list}>
          {todos.map((t, i) => (
            <div key={t.id} className={`${styles.item} ${styles['status_' + t.status]}`}>
              <span className={styles.statusIcon}>{STATUS_GLYPH[t.status]}</span>
              <span className={styles.itemIndex}>{i + 1}.</span>
              <span className={styles.itemContent}>{t.content}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
