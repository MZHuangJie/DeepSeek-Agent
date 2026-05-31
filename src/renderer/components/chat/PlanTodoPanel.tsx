import React, { useState, useEffect, useRef } from 'react';
import type { PlanTodo } from '../../stores/chat';
import styles from './PlanTodoPanel.module.css';

interface Props {
  todos: PlanTodo[];
  planDocPath?: string;
  executing: boolean;
  onExecute: () => void;
  onStop: () => void;
  onClose: () => void;
}

const STATUS_GLYPH: Record<PlanTodo['status'], string> = {
  pending: '○',
  in_progress: '◐',
  completed: '✓',
  cancelled: '✕',
};

export default function PlanTodoPanel({ todos, planDocPath, executing, onExecute, onStop, onClose }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const done = todos.filter(t => t.status === 'completed').length;
  const allDone = done === todos.length;

  // 全部任务完成后，等执行结束自动关闭面板
  useEffect(() => {
    if (allDone && !executing) {
      const timer = setTimeout(() => onCloseRef.current(), 2000);
      return () => clearTimeout(timer);
    }
  }, [allDone, executing]);

  if (todos.length === 0) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.header} onClick={() => setCollapsed(c => !c)}>
        <span className={styles.chevron}>{collapsed ? '▶' : '▼'}</span>
        <span className={styles.title}>任务清单</span>
        <span className={styles.progress}>{done}/{todos.length}</span>
        {planDocPath && <span className={styles.docPath} title={planDocPath}>{planDocPath}</span>}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            disabled={executing}
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            title={executing ? '请先停止执行' : '关闭任务清单（计划文档仍保留）'}
          >
            取消
          </button>
          {executing ? (
            <button
              className={`${styles.execBtn} ${styles.stopBtn}`}
              onClick={(e) => { e.stopPropagation(); onStop(); }}
              title="停止执行计划"
            >
              ■ 停止执行
            </button>
          ) : (
            <button
              className={styles.execBtn}
              disabled={allDone}
              onClick={(e) => { e.stopPropagation(); onExecute(); }}
              title={allDone ? '全部任务已完成' : '切换到 Agent 模式并逐项执行'}
            >
              {allDone ? '已完成' : '▶ 执行计划'}
            </button>
          )}
        </div>
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
