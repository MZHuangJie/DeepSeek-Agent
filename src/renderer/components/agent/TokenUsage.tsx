import React from 'react';
import { useAgentStore } from '../../stores/agent';

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return n.toString();
}

export default function TokenUsage() {
  const { tokenStats } = useAgentStore();
  const s = tokenStats ?? { total: 0, prompt: 0, completion: 0, toolTokens: 0, contextWindow: 0, contextMax: 100000, cost: 0 };

  const promptPct = s.total > 0 ? (s.prompt / s.total * 100).toFixed(1) : '0.0';
  const completionPct = s.total > 0 ? (s.completion / s.total * 100).toFixed(1) : '0.0';
  const toolPct = s.total > 0 ? (s.toolTokens ?? 0) / s.total * 100 : 0;
  const ctxPct = s.contextMax > 0 ? (s.contextWindow / s.contextMax * 100).toFixed(1) : '0.0';

  return (
    <div style={{ padding: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>
        Token 用量
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
        {fmt(s.total)}
      </div>

      <div style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ color: 'var(--text-secondary)' }}>提示词 Tokens</span>
        <span>{fmt(s.prompt)} ({promptPct}%)</span>
      </div>
      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 4, height: 4, marginBottom: 6, overflow: 'hidden' }}>
        <div style={{ width: `${s.total > 0 ? promptPct : 0}%`, height: '100%', background: '#6366f1', borderRadius: 4 }} />
      </div>

      <div style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ color: 'var(--text-secondary)' }}>回复 Tokens</span>
        <span>{fmt(s.completion)} ({completionPct}%)</span>
      </div>
      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 4, height: 4, marginBottom: 6, overflow: 'hidden' }}>
        <div style={{ width: `${s.total > 0 ? completionPct : 0}%`, height: '100%', background: '#22c55e', borderRadius: 4 }} />
      </div>

      <div style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ color: 'var(--text-secondary)' }}>工具 Tokens</span>
        <span>{fmt(s.toolTokens ?? 0)} ({toolPct.toFixed(1)}%)</span>
      </div>
      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 4, height: 4, marginBottom: 8, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(toolPct, 100)}%`, height: '100%', background: '#f59e0b', borderRadius: 4 }} />
      </div>

      <div style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ color: 'var(--text-secondary)' }}>上下文窗口</span>
        <span>{fmt(s.contextWindow)} / {fmt(s.contextMax)}</span>
      </div>
      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 4, height: 4, marginBottom: 6, overflow: 'hidden' }}>
        <div style={{ width: `${ctxPct}%`, height: '100%', background: 'var(--accent)', borderRadius: 4 }} />
      </div>
    </div>
  );
}
