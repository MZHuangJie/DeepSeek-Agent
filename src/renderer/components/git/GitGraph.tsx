import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GitIconArrowDown, GitIconArrowUp, GitIconRefresh, GitIconSync } from './GitIcons';
import {
  CIRCLE_RADIUS,
  CIRCLE_STROKE_WIDTH,
  SWIMLANE_HEIGHT,
  SWIMLANE_WIDTH,
  buildGraphRowGraphics,
  getDisplayRefs,
  laneX,
  toGitGraphViewModels,
  type GitGraphCommit,
  type GitGraphViewModel,
} from '../../utils/gitGraphLayout';
import styles from './GitGraph.module.css';

interface Props {
  refreshToken: number;
  disabled?: boolean;
  onPull?: () => void;
  onPush?: () => void;
  onFetch?: () => void;
}

function GraphRowSvg({ g }: { g: ReturnType<typeof buildGraphRowGraphics> }) {
  const cx = laneX(g.circleIndex);
  const cy = SWIMLANE_WIDTH;

  return (
    <svg
      className={styles.rowSvg}
      width={g.width}
      height={g.height}
      viewBox={`0 0 ${g.width} ${g.height}`}
      aria-hidden
    >
      {g.paths.map((seg, i) => (
        <path
          key={i}
          d={seg.d}
          fill="none"
          stroke={seg.color}
          strokeWidth={1}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {g.kind === 'HEAD' && (
        <>
          <circle
            cx={cx}
            cy={cy}
            r={CIRCLE_RADIUS + 3}
            fill="none"
            stroke={g.circleColor}
            strokeWidth={CIRCLE_STROKE_WIDTH}
          />
          <circle cx={cx} cy={cy} r={CIRCLE_STROKE_WIDTH} fill={g.circleColor} />
        </>
      )}
      {g.kind === 'node' && g.parentCount > 1 && (
        <>
          <circle
            cx={cx}
            cy={cy}
            r={CIRCLE_RADIUS + 2}
            fill="none"
            stroke={g.circleColor}
            strokeWidth={CIRCLE_STROKE_WIDTH}
          />
          <circle
            cx={cx}
            cy={cy}
            r={CIRCLE_RADIUS - 1}
            fill={g.circleColor}
            stroke={g.circleColor}
            strokeWidth={CIRCLE_STROKE_WIDTH}
          />
        </>
      )}
      {g.kind === 'node' && g.parentCount <= 1 && (
        <circle
          cx={cx}
          cy={cy}
          r={CIRCLE_RADIUS + 1}
          fill={g.circleColor}
          stroke={g.circleColor}
          strokeWidth={CIRCLE_STROKE_WIDTH}
        />
      )}
    </svg>
  );
}

function GraphRow({ vm }: { vm: GitGraphViewModel }) {
  const { locals, hasRemote } = getDisplayRefs(vm.commit.refs);
  const uniqueLocals = [...new Set(locals)];
  const g = buildGraphRowGraphics(vm);

  return (
    <div
      className={styles.row}
      title={`${vm.commit.message}\n${vm.commit.author} · ${vm.commit.date}`}
    >
      <div className={styles.graphCol} style={{ width: g.width }}>
        <GraphRowSvg g={g} />
      </div>
      <div className={styles.contentCol}>
        <div className={styles.messageLine}>
          {uniqueLocals.slice(0, 2).map(name => (
            <span key={name} className={styles.branchBadge}>{name}</span>
          ))}
          {hasRemote && <span className={styles.remoteBadge} title="Remote">☁</span>}
          <span className={styles.message}>{vm.commit.message}</span>
          <span className={styles.author}>{vm.commit.author}</span>
        </div>
      </div>
    </div>
  );
}

export default function GitGraph({ refreshToken, disabled, onPull, onPush, onFetch }: Props) {
  const [commits, setCommits] = useState<GitGraphCommit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadGraph = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await window.api.git.graph(50);
      if (!res.success) {
        setCommits([]);
        setError(res.error);
        return;
      }
      setCommits(res.commits);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGraph();
  }, [loadGraph, refreshToken]);

  const viewModels = useMemo(() => toGitGraphViewModels(commits), [commits]);

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <span className={styles.title}>图表</span>
        <div className={styles.tools}>
          <span className={styles.autoLabel}>自动</span>
          <button type="button" className={styles.toolBtn} title="Pull" disabled={disabled} onClick={onPull}>
            <GitIconArrowDown size={12} />
          </button>
          <button type="button" className={styles.toolBtn} title="Push" disabled={disabled} onClick={onPush}>
            <GitIconArrowUp size={12} />
          </button>
          <button type="button" className={styles.toolBtn} title="Fetch" disabled={disabled} onClick={onFetch}>
            <GitIconSync size={12} />
          </button>
          <button type="button" className={styles.toolBtn} title="Refresh Graph" disabled={disabled || loading} onClick={() => void loadGraph()}>
            <GitIconRefresh size={12} />
          </button>
        </div>
      </div>

      <div className={styles.list}>
        {loading && commits.length === 0 && (
          <div className={styles.placeholder}>加载提交历史…</div>
        )}
        {!loading && error && (
          <div className={styles.placeholder}>{error}</div>
        )}
        {!loading && !error && viewModels.length === 0 && (
          <div className={styles.placeholder}>暂无提交记录</div>
        )}
        {viewModels.map(vm => (
          <GraphRow key={vm.commit.hash} vm={vm} />
        ))}
      </div>
    </div>
  );
}
