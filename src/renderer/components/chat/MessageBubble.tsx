import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Message } from '../../stores/chat';
import { useRefsStore } from '../../stores/refs';
import ThinkingChain from './ThinkingChain';
import styles from '../../styles/components.module.css';

interface Props {
  message: Message;
}

// 轻量 markdown 解析：识别图片 ![alt](url) 和普通文本
function parseMarkdown(content: string): Array<
  | { type: 'text'; text: string }
  | { type: 'image'; alt: string; url: string }
  | { type: 'link'; text: string; url: string }
> {
  const result: ReturnType<typeof parseMarkdown> = [];
  // 匹配 ![alt](url) 或 [text](url)，优先匹配图片
  const regex = /(!?\[([^\]]*)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      result.push({ type: 'text', text: content.slice(lastIndex, match.index) });
    }
    const isImage = match[0].startsWith('!');
    if (isImage) {
      result.push({ type: 'image', alt: match[2], url: match[3] });
    } else {
      result.push({ type: 'link', text: match[2], url: match[3] });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    result.push({ type: 'text', text: content.slice(lastIndex) });
  }

  return result;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  return (
    <button onClick={handleCopy} className={styles.copyBtn} style={{ color: copied ? '#22c55e' : undefined }}>
      {copied ? '✓ 已复制' : '📋 复制链接'}
    </button>
  );
}

function isImageUrl(url: string): boolean {
  const lower = url.toLowerCase();
  // 常见图片扩展名
  if (/\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/.test(lower)) return true;
  // 常见生图/CDN 域名
  if (lower.includes('dalle') || lower.includes('blob.core.windows.net') || lower.includes('openai') || lower.includes('cdn.openai')) return true;
  // base64 图片
  if (lower.startsWith('data:image/')) return true;
  return false;
}

function ImageCard({ url, alt }: { url: string; alt: string }) {
  const [loaded, setLoaded] = useState(true);
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    setLoaded(true);
    // Windows 本地绝对路径 → 通过 IPC 读 base64
    if (/^[A-Za-z]:[\\/]/.test(url)) {
      window.api.files.readBinary(url).then(setResolved).catch(() => setLoaded(false));
    } else {
      setResolved(url);
    }
  }, [url]);

  const src = resolved || url;

  if (!loaded) {
    return (
      <div style={{ margin: '8px 0' }}>
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline', fontSize: 13 }}>
          {alt || '图片链接'}
        </a>
        <div style={{ marginTop: 4 }}>
          <CopyButton text={url} />
        </div>
      </div>
    );
  }

  return (
    <div key={url} style={{ margin: '8px 0' }}>
      <img
        src={url}
        alt={alt}
        style={{
          maxWidth: '100%',
          maxHeight: 400,
          borderRadius: 6,
          border: '1px solid var(--border)',
          display: 'block',
          cursor: 'pointer',
        }}
        onClick={() => window.open(url, '_blank')}
        onError={() => setLoaded(false)}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
        <CopyButton text={url} />
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          点击图片可在新标签页打开
        </span>
      </div>
    </div>
  );
}

function isImageGenerationContext(content: string): boolean {
  const lower = content.toLowerCase();
  return lower.includes('generate_image') || lower.includes('generateimage') ||
    lower.includes('生成') && (lower.includes('图') || lower.includes('画') || lower.includes('image'));
}

const AT_PATH_RE = /@([A-Za-z]:[\\/][\S]+)/g;

function RichText({ text }: { text: string }) {
  const parts: Array<{ type: 'text'; value: string } | { type: 'at'; path: string }> = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = AT_PATH_RE.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: 'text', value: text.slice(last, m.index) });
    const name = m[1].split(/[\\/]/).pop() || m[1];
    parts.push({ type: 'at', path: name });
    last = AT_PATH_RE.lastIndex;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  if (parts.length === 0) return <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>;
  return (
    <>
      {parts.map((p, i) =>
        p.type === 'text'
          ? <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{p.value}</span>
          : <span key={i} style={{ fontSize: 10, color: 'var(--accent)', background: 'rgba(124,58,237,0.08)', borderRadius: 3, padding: '1px 4px', margin: '0 1px' }}>@{p.path}</span>
      )}
    </>
  );
}

function MessageContent({ content }: { content: string }) {
  const parts = useMemo(() => parseMarkdown(content), [content]);
  const imageContext = useMemo(() => isImageGenerationContext(content), [content]);

  if (parts.length === 1 && parts[0].type === 'text') {
    if (isImageUrl(content.trim()) || content.trim().startsWith('data:image/')) {
      return <ImageCard url={content.trim()} alt="" />;
    }
    return <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}><RichText text={content} /></div>;
  }

  return (
    <div style={{ wordBreak: 'break-word' }}>
      {parts.map((part, idx) => {
        if (part.type === 'text') {
          return <RichText key={idx} text={part.text} />;
        }
        if (part.type === 'image') {
          return <ImageCard key={idx} url={part.url} alt={part.alt} />;
        }
        if (part.type === 'link') {
          if (isImageUrl(part.url)) {
            return <ImageCard key={idx} url={part.url} alt={part.text} />;
          }
          return (
            <a
              key={idx}
              href={part.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent)', textDecoration: 'underline' }}
            >
              {part.text || part.url}
            </a>
          );
        }
        return null;
      })}
    </div>
  );
}

function ToolCallCard({ tc }: { tc: import('../../stores/chat').ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const isRunning = tc.status === 'running';
  const isSuccess = tc.status === 'success';
  const isError = tc.status === 'error';

  const statusColor = isRunning ? 'var(--accent)' : isError ? '#ef4444' : '#22c55e';
  const bgColor = isRunning ? 'rgba(124,58,237,0.06)' : isError ? 'rgba(239,68,68,0.06)' : 'rgba(34,197,94,0.04)';

  return (
    <div style={{ marginTop: 4, fontSize: 11, background: bgColor, borderRadius: 6, border: `1px solid ${statusColor}20`, overflow: 'hidden' }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ color: statusColor }}>{expanded ? '▼' : '▶'}</span>
        {isRunning ? (
          <span style={{ display: 'inline-block', width: 10, height: 10, border: `2px solid ${statusColor}40`, borderTopColor: statusColor, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        ) : isSuccess ? (
          <svg width="12" height="12" viewBox="0 0 16 16"><path d="M3 8l3 3 7-7" stroke="#22c55e" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 16 16"><path d="M8 1v10M4 6l4 4 4-4" stroke="#ef4444" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><circle cx="8" cy="14" r="1" fill="#ef4444"/></svg>
        )}
        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{tc.name}</span>
        {isRunning && <span style={{ color: 'var(--text-secondary)', marginLeft: 'auto' }}>执行中...</span>}
        {isSuccess && <span style={{ color: '#22c55e', marginLeft: 'auto' }}>完成</span>}
        {isError && <span style={{ color: '#ef4444', marginLeft: 'auto' }}>失败</span>}
      </div>
      {expanded && (
        <div style={{ padding: '6px 10px 8px', borderTop: `1px solid ${statusColor}20` }}>
          <div style={{ marginBottom: 4 }}>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 2, fontWeight: 500 }}>请求参数：</div>
            <pre style={{ margin: 0, padding: '4px 8px', background: 'var(--bg-primary)', borderRadius: 4, fontSize: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 120, overflow: 'auto', color: 'var(--text-primary)' }}>
              {JSON.stringify(tc.args, null, 2)}
            </pre>
          </div>
          {tc.result && (
            <div>
              <div style={{ color: 'var(--text-secondary)', marginBottom: 2, fontWeight: 500 }}>返回数据：</div>
              <pre style={{ margin: 0, padding: '4px 8px', background: 'var(--bg-primary)', borderRadius: 4, fontSize: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 200, overflow: 'auto', color: 'var(--text-primary)' }}>
                {tc.result.length > 2000 ? tc.result.slice(0, 2000) + '\n...[已截断]...' : tc.result}
              </pre>
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function ToolCallProgress({ toolCalls }: { toolCalls?: import('../../stores/chat').ToolCall[] }) {
  if (!toolCalls || toolCalls.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {toolCalls.map((tc, i) => <ToolCallCard key={i} tc={tc} />)}
    </div>
  );
}


function UserActions({ message, visible }: { message: Message; visible: boolean }) {
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content);
  }, [message.content]);

  const fillTextarea = useCallback((text: string, focus: boolean) => {
    const textarea = document.querySelector<HTMLTextAreaElement>('textarea[placeholder*="Ask DeepSeek"]');
    if (!textarea) return;
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    nativeInputValueSetter?.call(textarea, text);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    if (focus) textarea.focus();
  }, []);

  const handleResend = useCallback(() => {
    fillTextarea(message.content, false);
    // React 17+ 通过 root delegation 捕获原生事件，调度 keydown Enter 即可触发发送
    setTimeout(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>('textarea[placeholder*="Ask DeepSeek"]');
      textarea?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
    }, 50);
  }, [message.content, fillTextarea]);

  const handleAddToContext = useCallback(() => {
    useRefsStore.getState().addTextRef(message.content);
  }, [message.content]);

  return (
    <div
      style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', paddingRight: 2, opacity: visible ? 1 : 0, transition: 'opacity 0.2s ease' }}
    >
      <ActionBtn onClick={handleCopy} title="复制">
        <img src="/assets/file.png" alt="复制" style={{ width: 14, height: 14 }} />
      </ActionBtn>
      <ActionBtn onClick={handleResend} title="重新发送">
        <img src="/assets/refresh.png" alt="重新发送" style={{ width: 14, height: 14 }} />
      </ActionBtn>
      <ActionBtn onClick={handleAddToContext} title="添加到对话">
        <img src="/assets/add.png" alt="添加到对话" style={{ width: 14, height: 14 }} />
      </ActionBtn>
    </div>
  );
}

function ActionBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return <button onClick={onClick} title={title} className={styles.actionBtn}>{children}</button>;
}
const MessageBubble = React.memo(function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';
  const hasThinking = !isUser && !!message.thinkingContent;
  const hasContent = !!message.content;
  const showContentBubble = isUser || !hasThinking || hasContent;
  const [actionsVisible, setActionsVisible] = useState(false);

  return (
    <div
      onMouseEnter={() => setActionsVisible(true)}
      onMouseLeave={() => setActionsVisible(false)}
      style={{ display: 'flex', gap: 8, marginBottom: 12, flexDirection: isUser ? 'row-reverse' : 'row' }}
    >
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: isUser ? 'var(--accent)' : 'linear-gradient(135deg, #6366f1, #7c3aed)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, flexShrink: 0, color: '#fff', fontWeight: 600,
      }}>
        <img src={isUser ? '/assets/head.png' : '/assets/ai_avater.png'} alt={isUser ? 'user' : 'ai'} style={{ width: 28, height: 28, borderRadius: '50%' }} />
      </div>
      <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* 1. Thinking chain displayed above content for AI messages */}
        {hasThinking && (
          <ThinkingChain text={message.thinkingContent!} hasContent={hasContent} />
        )}

        {/* 2. Tool call progress — always show if running, even without content */}
        <ToolCallProgress toolCalls={message.toolCalls} />

        {/* 3. Response content bubble rendered after thinking is done */}
        {showContentBubble && (
          <div style={{
            padding: '10px 14px', borderRadius: 8,
            background: isUser ? 'var(--chat-user)' : 'var(--chat-ai)',
            border: isUser ? '1px solid rgba(124,58,237,0.3)' : '1px solid var(--border)',
            fontSize: 13, lineHeight: 1.5,
          }}>
            <MessageContent content={message.content || '...'} />
          </div>
        )}

        {/* 4. User message actions */}
        {isUser && <UserActions message={message} visible={actionsVisible} />}
      </div>
    </div>
  );
});

export default MessageBubble;
