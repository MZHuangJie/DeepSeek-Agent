import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useFilesStore } from '../../stores/files';
import { useModelStore } from '../../stores/model';
import { useChatStore } from '../../stores/chat';
import ModelSettings from '../settings/ModelSettings';
import PluginManager from '../plugins/PluginManager';
import { usePluginStore } from '../../stores/plugin';
import { useRefsStore } from '../../stores/refs';
import { useModeStore, MODES, AgentMode } from '../../stores/mode';
import { COMMANDS, matchCommand, getCommandList, Command } from '../../commands';
import Dropdown, { DropdownItem } from './Dropdown';
import styles from '../../styles/components.module.css';

interface Props {
  onSend: (message: string, command?: Command) => void;
  disabled: boolean;
  isStreaming: boolean;
  onStop: () => void;
}

const MIN_HEIGHT = 48;   // ~2 rows + padding
const MAX_HEIGHT = 180;  // ~8 rows + padding

export default function ChatInput({ onSend, disabled, isStreaming, onStop }: Props) {
  const [value, setValue] = useState('');
  const [atMaxHeight, setAtMaxHeight] = useState(false);
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [showModelSettings, setShowModelSettings] = useState(false);
  const [showPluginManager, setShowPluginManager] = useState(false);
  const [showModeSelect, setShowModeSelect] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { openTabs } = useFilesStore();
  const showMention = value.includes('@') && openTabs.length > 0;
  const { models, activeModelId, setActiveModel } = useModelStore();
  const { createSession } = useChatStore();
  const { installedPlugins, loadInstalled } = usePluginStore();
  const refs = useRefsStore();

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
      if (trimmed.startsWith('/browse')) {
        const url = trimmed.slice(7).trim();
        window.api.browser.open(url || undefined);
        setValue('');
        return;
      }
      if (trimmed === '/plugin') {
        setShowPluginManager(true);
        setValue('');
        return;
      }
      if (trimmed) {
        const cmd = matchCommand(trimmed, pluginCommands);
        const msg = cmd ? trimmed.slice(cmd.name.length + 1).trim() : trimmed;
        const prefix = refs.refFiles.map(p => `@${p} `).join('');
        const suffix = refs.textRefs.length > 0 ? '\n\n---\n引用消息：\n' + refs.textRefs.join('\n---\n') : '';
        onSend(prefix + (msg || trimmed) + suffix, cmd || undefined);
        setValue('');
        refs.clearRefs();
        setAtMaxHeight(false);
        if (textareaRef.current) textareaRef.current.style.height = `${MIN_HEIGHT}px`;
      }
    }
    if (e.key === 'Escape') {
      if (isStreaming) { onStop(); return; }
      setShowModelSelect(false); setShowModeSelect(false);
    }
  }, [value, onSend, isStreaming, onStop]);

  const selectCommand = (cmd: Command) => {
    setValue('/' + cmd.name + ' ');
    textareaRef.current?.focus();
  };

  const insertMention = (path: string) => {
    setValue(v => v.slice(0, v.lastIndexOf('@')).trimEnd());
    refs.addRefFile(path);
    textareaRef.current?.focus();
  };

  const handleSend = () => {
    const trimmed = value.trim();
    if (trimmed.startsWith('/browse')) {
      const url = trimmed.slice(7).trim();
      window.api.browser.open(url || undefined);
      setValue('');
      return;
    }
    if (trimmed === '/plugin') {
      setShowPluginManager(true);
      setValue('');
      return;
    }
    if (trimmed) {
      const cmd = matchCommand(trimmed, pluginCommands);
      const msg = cmd ? trimmed.slice(cmd.name.length + 1).trim() : trimmed;
      const prefix = refs.refFiles.map(p => `@${p} `).join('');
      onSend(prefix + (msg || trimmed), cmd || undefined);
      setValue('');
      refs.clearRefs();
      setAtMaxHeight(false);
      if (textareaRef.current) textareaRef.current.style.height = `${MIN_HEIGHT}px`;
    }
  };

  return (
    <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', position: 'relative', background: 'var(--bg-secondary)' }}>
      {/* Command palette */}
      {showCommandPalette && filteredCommands.length > 0 && (
        <Dropdown maxHeight={260}>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', padding: '6px 10px 4px', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>命令</div>
          {filteredCommands.map(cmd => (
            <DropdownItem key={cmd.name} onClick={() => selectCommand(cmd)}>
              <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 600, flexShrink: 0, marginRight: 8 }}>/{cmd.name}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{cmd.description}</span>
            </DropdownItem>
          ))}
        </Dropdown>
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
        <div className={styles.mentionPopup}>
          {openTabs.map(t => (
            <div key={t.path} className={styles.mentionItem} onClick={() => insertMention(t.path)}>{t.name}</div>
          ))}
        </div>
      )}

      {/* Text reference chips */}
      {refs.textRefs.length > 0 && (
        <div className={styles.chipBar}>
          {refs.textRefs.map((text, i) => {
            const label = text.length > 40 ? text.slice(0, 40) + '...' : text;
            return (
              <div key={i} className={`${styles.chip} ${styles.chipText}`}>
                <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                <span className={styles.chipClose} onClick={() => refs.removeTextRef(text)} title="取消引用">✕</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Referenced files chips */}
      {refs.refFiles.length > 0 && (
        <div className={styles.chipBar}>
          {refs.refFiles.map((path, i) => {
            const name = path.split(/[\\/]/).pop() || path;
            return (
              <div key={i} className={`${styles.chip} ${styles.chipFile}`}>
                <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                <span className={styles.chipClose} onClick={() => refs.removeRefFile(path)} title="取消引用">✕</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Input area */}
      <div className={`${styles.inputWrapper} ${activeCommand ? styles.inputWrapperActive : ''}`}>
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'AI 正在回复...' : 'Ask DeepSeek Agent... (/ commands · @ files)'}
          disabled={disabled}
          spellCheck={false}
          className={styles.textarea}
          style={{
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
                <Dropdown minWidth={200}>
                  {models.map(m => (
                    <DropdownItem key={m.id} active={m.id === activeModelId} onClick={() => { setActiveModel(m.id); setShowModelSelect(false); }}>
                      <div style={{ fontWeight: 500 }}>{m.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{m.model}</div>
                    </DropdownItem>
                  ))}
                  <DropdownItem onClick={() => { setShowModelSelect(false); setShowModelSettings(true); }}>
                    <span style={{ color: 'var(--text-secondary)' }}>管理模型...</span>
                  </DropdownItem>
                </Dropdown>
              )}
            </div>

            {/* New session */}
            <ToolbarBtn title="新建会话" onClick={() => createSession()}>
              <img src="/assets/13.png" alt="new" style={{ width: 14, height: 14, opacity: 0.7 }} />
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
                <img src={activeMode.icon} alt="" style={{ width: 14, height: 14 }} />
                <span>{activeMode.label}</span>
                <span style={{ fontSize: 8, opacity: 0.6 }}>▼</span>
              </button>

              {showModeSelect && (
                <Dropdown minWidth={180}>
                  {MODES.map(m => (
                    <DropdownItem key={m.id} active={m.id === mode} onClick={() => { setMode(m.id as AgentMode); setShowModeSelect(false); }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <img src={m.icon} alt="" style={{ width: 16, height: 16 }} />
                        <div>
                          <div style={{ fontWeight: 500 }}>{m.label}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{m.description}</div>
                        </div>
                      </div>
                    </DropdownItem>
                  ))}
                </Dropdown>
              )}
            </div>
          </div>

          {/* Right: send/stop */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
  return <button onClick={onClick} title={title} className={styles.toolbarBtn}>{children}</button>;
}
