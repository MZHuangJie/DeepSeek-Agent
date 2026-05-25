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
import Dropdown, { DropdownItem, useDropdownNav } from './Dropdown';
import shared from '../../styles/components.module.css';
import styles from './ChatInput.module.css';

export interface PastedImage {
  id: string;
  dataUrl: string;
  path: string;
  mimeType: string;
}

interface Props {
  onSend: (message: string, command?: Command, images?: PastedImage[]) => void;
  disabled: boolean;
  isStreaming: boolean;
  onStop: () => void;
}

const MIN_HEIGHT = 48;
const MAX_HEIGHT = 180;

export default function ChatInput({ onSend, disabled, isStreaming, onStop }: Props) {
  const [value, setValue] = useState('');
  const [atMaxHeight, setAtMaxHeight] = useState(false);
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [showModelSettings, setShowModelSettings] = useState(false);
  const [showPluginManager, setShowPluginManager] = useState(false);
  const [showModeSelect, setShowModeSelect] = useState(false);
  const [images, setImages] = useState<PastedImage[]>([]);
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

  const pluginCommands: Command[] = useMemo(() =>
    installedPlugins.map(p => ({
      name: p.name,
      description: p.description || '',
      detail: `已安装插件: ${p.name}`,
      systemPrompt: p.system_prompt,
    })), [installedPlugins]);

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

  const cmdFocusIdx = useDropdownNav(filteredCommands.length, (i) => selectCommand(filteredCommands[i]), () => {}, showCommandPalette && filteredCommands.length > 0);
  const mentionFocusIdx = useDropdownNav(openTabs.length, (i) => insertMention(openTabs[i].path), () => {}, showMention);

  const hasDropdownOpen = showCommandPalette || showMention || showModelSelect || showModeSelect;

  const removeImage = useCallback((id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  }, []);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) continue;
        const id = `img-${Date.now()}-${i}`;
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(',')[1];
          const mimeType = item.type;
          try {
            const filePath = await window.api.files.saveClipboardImage(base64, mimeType);
            setImages(prev => [...prev, { id, dataUrl, path: filePath, mimeType }]);
          } catch {
            // 保存失败时仍用 dataUrl 显示缩略图
            setImages(prev => [...prev, { id, dataUrl, path: '', mimeType }]);
          }
        };
        reader.readAsDataURL(blob);
      }
    }
  }, []);

  const clearImages = useCallback(() => setImages([]), []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (hasDropdownOpen && (e.key === 'Enter' || e.key === 'Escape')) {
      return;
    }

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
        onSend(prefix + (msg || trimmed) + suffix, cmd || undefined, images.length > 0 ? images : undefined);
        setValue('');
        refs.clearRefs();
        clearImages();
        setAtMaxHeight(false);
        if (textareaRef.current) textareaRef.current.style.height = `${MIN_HEIGHT}px`;
      }
    }
    if (e.key === 'Escape') {
      if (isStreaming) { onStop(); return; }
      setShowModelSelect(false); setShowModeSelect(false);
    }
  }, [value, onSend, isStreaming, onStop, hasDropdownOpen, images, clearImages]);

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
      onSend(prefix + (msg || trimmed), cmd || undefined, images.length > 0 ? images : undefined);
      setValue('');
      refs.clearRefs();
      clearImages();
      setAtMaxHeight(false);
      if (textareaRef.current) textareaRef.current.style.height = `${MIN_HEIGHT}px`;
    }
  };

  return (
    <div className={styles.container} onPaste={handlePaste}>
      {/* Command palette */}
      {showCommandPalette && filteredCommands.length > 0 && (
        <Dropdown maxHeight={260}>
          <div className={styles.paletteHeading}>命令</div>
          {filteredCommands.map((cmd, i) => (
            <DropdownItem key={cmd.name} onClick={() => selectCommand(cmd)} focused={cmdFocusIdx === i}>
              <span className={styles.cmdChip}>/{cmd.name}</span>
              <span className={styles.cmdDesc}>{cmd.description}</span>
            </DropdownItem>
          ))}
        </Dropdown>
      )}

      {/* Active command indicator */}
      {activeCommand && (
        <div className={styles.cmdHint}>
          <span className={styles.cmdBadge}>/{activeCommand.name}</span>
          <span className={styles.cmdDetail}>{activeCommand.detail}</span>
        </div>
      )}

      {/* @ mention popup */}
      {showMention && (
        <div className={shared.mentionPopup}>
          {openTabs.map((t, i) => (
            <div key={t.path} className={shared.mentionItem} onClick={() => insertMention(t.path)}
              style={{ background: mentionFocusIdx === i ? 'var(--bg-tertiary)' : undefined }}>{t.name}</div>
          ))}
        </div>
      )}

      {/* Text reference chips */}
      {refs.textRefs.length > 0 && (
        <div className={shared.chipBar}>
          {refs.textRefs.map((text, i) => {
            const label = text.length > 40 ? text.slice(0, 40) + '...' : text;
            return (
              <div key={i} className={`${shared.chip} ${shared.chipText}`}>
                <span className={styles.chipLabel}>{label}</span>
                <span className={shared.chipClose} onClick={() => refs.removeTextRef(text)} title="取消引用">✕</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Referenced files chips */}
      {refs.refFiles.length > 0 && (
        <div className={shared.chipBar}>
          {refs.refFiles.map((path, i) => {
            const name = path.split(/[\\/]/).pop() || path;
            return (
              <div key={i} className={`${shared.chip} ${shared.chipFile}`}>
                <span className={styles.fileChipLabel}>{name}</span>
                <span className={shared.chipClose} onClick={() => refs.removeRefFile(path)} title="取消引用">✕</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Pasted image thumbnails */}
      {images.length > 0 && (
        <div className={styles.imageStrip}>
          {images.map(img => (
            <div key={img.id} className={styles.imageChip}>
              <img src={img.dataUrl} alt="" className={styles.imageThumb} />
              <span className={styles.imageRemove} onClick={() => removeImage(img.id)} title="移除图片">✕</span>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className={`${shared.inputWrapper} ${activeCommand ? shared.inputWrapperActive : ''}`}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'AI 正在回复...' : 'Ask DeepSeek Agent... (/ commands · @ files)'}
          disabled={disabled}
          spellCheck={false}
          className={shared.textarea}
          style={{
            minHeight: MIN_HEIGHT,
            maxHeight: MAX_HEIGHT,
            overflow: atMaxHeight ? 'auto' : 'hidden',
          }}
        />

        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            {/* Model dropdown */}
            <div className={styles.modelTrigger}>
              <button
                onClick={() => setShowModelSelect(!showModelSelect)}
                className={`${styles.modelBtn} ${shared.hoverSubtle}`}
              >
                <span>{activeModel?.name || 'Agent'}</span>
                <span className={styles.dropdownCaret}>▼</span>
              </button>

              {showModelSelect && (
                <Dropdown minWidth={200}>
                  {models.map(m => (
                    <DropdownItem key={m.id} active={m.id === activeModelId} onClick={() => { setActiveModel(m.id); setShowModelSelect(false); }}>
                      <div className={styles.itemName}>{m.name}</div>
                      <div className={styles.itemMeta}>{m.model}</div>
                    </DropdownItem>
                  ))}
                  <DropdownItem onClick={() => { setShowModelSelect(false); setShowModelSettings(true); }}>
                    <span className={styles.itemSub}>管理模型...</span>
                  </DropdownItem>
                </Dropdown>
              )}
            </div>

            <ToolbarBtn title="新建会话" onClick={() => createSession()}>
              <img src="/assets/13.png" alt="new" className={styles.toolbarIcon} />
            </ToolbarBtn>

            {/* Mode selector */}
            <div className={styles.modelTrigger}>
              <button
                onClick={() => setShowModeSelect(!showModeSelect)}
                title={activeMode.description}
                className={`${styles.modelBtn} ${shared.hoverSubtle}`}
              >
                <img src={activeMode.icon} alt="" className={styles.toolbarIcon} style={{ opacity: 1 }} />
                <span>{activeMode.label}</span>
                <span className={styles.dropdownCaret}>▼</span>
              </button>

              {showModeSelect && (
                <Dropdown minWidth={180}>
                  {MODES.map(m => (
                    <DropdownItem key={m.id} active={m.id === mode} onClick={() => { setMode(m.id as AgentMode); setShowModeSelect(false); }}>
                      <div className={styles.modeRow}>
                        <img src={m.icon} alt="" className={styles.modeIcon} />
                        <div>
                          <div className={styles.modeName}>{m.label}</div>
                          <div className={styles.modeDesc}>{m.description}</div>
                        </div>
                      </div>
                    </DropdownItem>
                  ))}
                </Dropdown>
              )}
            </div>
          </div>

          <div className={styles.toolbarRight}>
            {isStreaming ? (
              <button onClick={onStop} title="停止生成 (Esc)" className={styles.stopBtn}>
                <img src="/assets/stop.png" alt="stop" className={styles.stopIcon} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={disabled || !value.trim()}
                className={disabled || !value.trim() ? styles.sendBtnDisabled : styles.sendBtn}
              >
                <img src="/assets/9.png" alt="send" className={styles.sendIcon} />
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
  return <button onClick={onClick} title={title} className={shared.toolbarBtn}>{children}</button>;
}
