import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useFilesStore } from '../../stores/files';
import { useModelStore } from '../../stores/model';
import { useChatStore } from '../../stores/chat';
import ModelSettings from '../settings/ModelSettings';
import PluginManager from '../plugins/PluginManager';
import { usePluginStore } from '../../stores/plugin';
import { useModeStore, MODES, AgentMode } from '../../stores/mode';
import { COMMANDS, matchCommand, getCommandList, Command } from '../../commands';

interface Props {
  onSend: (message: string, command?: Command) => void;
  disabled: boolean;
  isStreaming: boolean;
  onStop: () => void;
  onToggleTerminal?: () => void;
}

const MIN_HEIGHT = 48;   // ~2 rows + padding
const MAX_HEIGHT = 180;  // ~8 rows + padding

export default function ChatInput({ onSend, disabled, isStreaming, onStop, onToggleTerminal }: Props) {
  const [value, setValue] = useState('');
  const [atMaxHeight, setAtMaxHeight] = useState(false);
  const [showMention, setShowMention] = useState(false);
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [showModelSettings, setShowModelSettings] = useState(false);
  const [showPluginManager, setShowPluginManager] = useState(false);
  const [showModeSelect, setShowModeSelect] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { openTabs } = useFilesStore();
  const { models, activeModelId, setActiveModel } = useModelStore();
  const { createSession } = useChatStore();
  const { installedPlugins, loadInstalled } = usePluginStore();

  const activeModel = models.find(m => m.id === activeModelId) ?? models[0];
  const { mode, setMode } = useModeStore();
  const activeMode = MODES.find(m => m.id === mode) ?? MODES[0];

  useEffect(() => { loadInstalled(); }, []);

  // 将已安装插件转换为动态命令
  const pluginCommands: Command[] = useMemo(() =>
    installedPlugins.map(p => ({
      name: p.name,
      description: p.description || '',
      detail: `已安装插件: ${p.name}`,
      systemPrompt: p.system_prompt,
    })), [installedPlugins]);

  // auto-resize: only grow when content overflows current height
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const prevH = el.clientHeight;
    el.style.height = 'auto';
    const needed = el.scrollHeight;
    let newH = prevH;
    if (needed > prevH + 2) {
      newH = Math.min(needed, MAX_HEIGHT);
    } else if (needed < prevH - 24) {
      newH = Math.max(needed, MIN_HEIGHT);
    }
    el.style.height = `${newH}px`;
    setAtMaxHeight(newH >= MAX_HEIGHT - 2);
  }, [value]);

  const activeCommand = useMemo(() => matchCommand(value, pluginCommands), [value, pluginCommands]);
  const showCommandPalette = value.startsWith('/') && !value.includes(' ') && value.length >= 1;
  const filteredCommands = useMemo(() => {
    if (!showCommandPalette) return [];
    const query = value.slice(1).toLowerCase();
    const allCommands = [...COMMANDS, ...pluginCommands];
    if (!query) return allCommands;
    return allCommands.filter(c => c.name.includes(query));
  }, [value, showCommandPalette, pluginCommands]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const trimmed = value.trim();
      if (trimmed === '/plugin') {
        setShowPluginManager(true);
        setValue('');
        return;
      }
      if (trimmed) {
        const cmd = matchCommand(trimmed, pluginCommands);
        const message = cmd ? trimmed.slice(cmd.name.length + 1).trim() : trimmed;
        onSend(message || trimmed, cmd || undefined);
        setValue('');
        setAtMaxHeight(false);
        if (textareaRef.current) textareaRef.current.style.height = `${MIN_HEIGHT}px`;
      }
    }
    if (e.key === '@') { setShowMention(true); }
    if (e.key === 'Escape') {
      if (isStreaming) { onStop(); return; }
      setShowMention(false); setShowModelSelect(false); setShowModeSelect(false);
    }
  }, [value, onSend, isStreaming, onStop]);

  const selectCommand = (cmd: Command) => {
    setValue('/' + cmd.name + ' ');
    textareaRef.current?.focus();
  };

  const insertMention = (path: string) => {
    setValue(v => v + path + ' ');
    setShowMention(false);
    textareaRef.current?.focus();
  };

  const handleSend = () => {
    const trimmed = value.trim();
    if (trimmed === '/plugin') {
      setShowPluginManager(true);
      setValue('');
      return;
    }
    if (trimmed) {
      const cmd = matchCommand(trimmed, pluginCommands);
      const message = cmd ? trimmed.slice(cmd.name.length + 1).trim() : trimmed;
      onSend(message || trimmed, cmd || undefined);
      setValue('');
      setAtMaxHeight(false);
      if (textareaRef.current) textareaRef.current.style.height = `${MIN_HEIGHT}px`;
    }
  };

  return (
    <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', position: 'relative', background: 'var(--bg-secondary)' }}>
      {/* Command palette */}
      {showCommandPalette && filteredCommands.length > 0 && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 12, right: 12,
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 8, padding: 4, maxHeight: 260, overflow: 'auto',
          zIndex: 100, marginBottom: 4, boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        }}>
          <div style={{
            fontSize: 10, color: 'var(--text-secondary)', padding: '6px 10px 4px',
            textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600,
          }}>
            命令
          </div>
          {filteredCommands.map(cmd => (
            <div key={cmd.name}
              onClick={() => selectCommand(cmd)}
              style={{
                padding: '6px 10px', cursor: 'pointer', borderRadius: 4,
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 12,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{
                background: 'var(--accent)', color: '#fff', borderRadius: 4,
                padding: '1px 6px', fontSize: 10, fontWeight: 600, flexShrink: 0,
              }}>
                /{cmd.name}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>{cmd.description}</span>
            </div>
          ))}
        </div>
      )}

      {/* Active command indicator */}
      {activeCommand && (
        <div style={{
          padding: '2px 12px 4px', fontSize: 11, color: 'var(--accent)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{
            background: 'rgba(124,58,237,0.15)', borderRadius: 4,
            padding: '1px 6px', fontWeight: 600,
          }}>
            /{activeCommand.name}
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>{activeCommand.detail}</span>
        </div>
      )}

      {/* @ mention popup */}
      {showMention && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 12, background: 'var(--bg-tertiary)',
          border: '1px solid var(--border)', borderRadius: 6, padding: 4, maxHeight: 160,
          overflow: 'auto', zIndex: 100, minWidth: 200, marginBottom: 4,
        }}>
          {openTabs.length === 0 && (
            <div style={{ padding: '4px 8px', fontSize: 11, color: 'var(--text-secondary)' }}>无打开的文件</div>
          )}
          {openTabs.map(t => (
            <div key={t.path} onClick={() => insertMention(t.path)} style={{
              padding: '4px 8px', cursor: 'pointer', fontSize: 12, borderRadius: 3,
              color: 'var(--text-primary)',
            }}>{t.name}</div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div style={{
        background: 'var(--bg-tertiary)',
        border: `1px solid ${activeCommand ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 10,
        transition: 'border-color 0.2s',
      }}>
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'AI 正在回复...' : 'Ask DeepSeek Agent... (/ commands · @ files)'}
          disabled={disabled}
          style={{
            width: '100%',
            background: 'transparent', border: 'none',
            color: 'var(--text-primary)',
            padding: '10px 12px 4px',
            fontSize: 13, resize: 'none',
            fontFamily: 'inherit', outline: 'none',
            lineHeight: 1.6,
            minHeight: MIN_HEIGHT,
            maxHeight: MAX_HEIGHT,
            overflow: atMaxHeight ? 'auto' : 'hidden',
          }}
        />

        {/* Bottom toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 8px 6px', gap: 8,
        }}>
          {/* Left: Model selector + hint + new session */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Model dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowModelSelect(!showModelSelect)}
                style={{
                  background: 'transparent', border: 'none',
                  color: 'var(--text-primary)', cursor: 'pointer',
                  padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 12, fontWeight: 500, borderRadius: 4,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span>{activeModel?.name || 'Agent'}</span>
                <span style={{ fontSize: 8, opacity: 0.6 }}>▼</span>
              </button>

              {showModelSelect && (
                <div style={{
                  position: 'absolute', bottom: '100%', left: 0, marginBottom: 4,
                  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  borderRadius: 8, minWidth: 200, maxHeight: 240, overflow: 'auto',
                  zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                }}>
                  {models.map(m => (
                    <div key={m.id}
                      onClick={() => { setActiveModel(m.id); setShowModelSelect(false); }}
                      style={{
                        padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                        background: m.id === activeModelId ? 'rgba(124,58,237,0.15)' : 'transparent',
                        color: m.id === activeModelId ? 'var(--accent)' : 'var(--text-primary)',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <div style={{ fontWeight: 500 }}>{m.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{m.model}</div>
                    </div>
                  ))}
                  <div onClick={() => { setShowModelSelect(false); setShowModelSettings(true); }}
                    style={{
                      padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                      color: 'var(--text-secondary)', textAlign: 'center',
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    管理模型...
                  </div>
                </div>
              )}
            </div>

            {/* New session */}
            <ToolbarBtn title="新建会话" onClick={() => createSession()}>
              <img src="/assets/13.png" alt="new" style={{ width: 14, height: 14, opacity: 0.7 }} />
            </ToolbarBtn>

            {/* Toggle terminal */}
            <ToolbarBtn title="终端" onClick={() => onToggleTerminal?.()}>
              <img src="/assets/3.png" alt="terminal" style={{ width: 16, height: 16, opacity: 0.7 }} />
            </ToolbarBtn>

            {/* Mode selector */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowModeSelect(!showModeSelect)}
                title={activeMode.description}
                style={{
                  background: 'transparent', border: 'none',
                  color: 'var(--text-primary)', cursor: 'pointer',
                  padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 12, fontWeight: 500, borderRadius: 4,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span>{activeMode.icon}</span>
                <span>{activeMode.label}</span>
                <span style={{ fontSize: 8, opacity: 0.6 }}>▼</span>
              </button>

              {showModeSelect && (
                <div style={{
                  position: 'absolute', bottom: '100%', left: 0, marginBottom: 4,
                  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  borderRadius: 8, minWidth: 180, overflow: 'hidden',
                  zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                }}>
                  {MODES.map(m => (
                    <div key={m.id}
                      onClick={() => { setMode(m.id as AgentMode); setShowModeSelect(false); }}
                      style={{
                        padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                        background: m.id === mode ? 'rgba(124,58,237,0.15)' : 'transparent',
                        color: m.id === mode ? 'var(--accent)' : 'var(--text-primary)',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 14 }}>{m.icon}</span>
                      <div>
                        <div style={{ fontWeight: 500 }}>{m.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{m.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: settings + send/stop */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <ToolbarBtn title="模型设置" onClick={() => setShowModelSettings(true)}>
              <img src="/assets/5.png" alt="settings" style={{ width: 16, height: 16, opacity: 0.7 }} />
            </ToolbarBtn>

            {isStreaming ? (
              <button
                onClick={onStop}
                title="停止生成 (Esc)"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 2,
                }}
              >
                <img src="/assets/stop.png" alt="stop" style={{ width: 20, height: 20 }} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={disabled || !value.trim()}
                style={{
                  background: disabled || !value.trim() ? 'transparent' : 'var(--accent)',
                  border: disabled || !value.trim() ? '1px solid var(--border)' : 'none',
                  color: disabled || !value.trim() ? 'var(--text-secondary)' : '#fff',
                  borderRadius: 6,
                  width: 32, height: 28,
                  cursor: disabled || !value.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 0,
                  transition: 'all 0.15s',
                }}
              >
                <img src="/assets/9.png" alt="send" style={{ width: 14, height: 12 }} />
              </button>
            )}
          </div>
        </div>
      </div>

      {showModelSettings && <ModelSettings onClose={() => setShowModelSettings(false)} />}
      {showPluginManager && <PluginManager onClose={() => setShowPluginManager(false)} />}
    </div>
  );
}

function ToolbarBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'transparent', border: 'none',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        padding: '4px 6px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 4,
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  );
}
