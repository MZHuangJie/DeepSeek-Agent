import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Message } from '../../stores/chat';
import { useFilesStore } from '../../stores/files';
import ThinkingChain from './ThinkingChain';

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
    <button
      onClick={handleCopy}
      style={{
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid var(--border)',
        color: copied ? '#22c55e' : 'var(--text-secondary)',
        borderRadius: 4,
        padding: '2px 8px',
        fontSize: 11,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
    >
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

function looksLikeImageLink(text: string): boolean {
  const lower = text.toLowerCase();
  const imageKeywords = ['图', '图片', '下载', 'image', 'photo', 'pic', 'download', '原图', '查看', '生成'];
  return imageKeywords.some(k => lower.includes(k));
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

function MessageContent({ content }: { content: string }) {
  const parts = useMemo(() => parseMarkdown(content), [content]);
  const imageContext = useMemo(() => isImageGenerationContext(content), [content]);

  if (parts.length === 1 && parts[0].type === 'text') {
    if (isImageUrl(content.trim()) || content.trim().startsWith('data:image/')) {
      return <ImageCard url={content.trim()} alt="" />;
    }
    return <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{content}</div>;
  }

  return (
    <div style={{ wordBreak: 'break-word' }}>
      {parts.map((part, idx) => {
        if (part.type === 'text') {
          return <span key={idx} style={{ whiteSpace: 'pre-wrap' }}>{part.text}</span>;
        }
        if (part.type === 'image') {
          return <ImageCard key={idx} url={part.url} alt={part.alt} />;
        }
        if (part.type === 'link') {
          if (isImageUrl(part.url) || looksLikeImageLink(part.text) || imageContext) {
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


function UserActions({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false);
  const { openTabs, activeTab } = useFilesStore();
  const activeFile = openTabs.find(t => t.path === activeTab);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
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
    const prefix = activeFile ? `@${activeFile.path}\n` : '';
    fillTextarea(`${prefix}用户之前说：${message.content}\n`, true);
  }, [message.content, activeFile, fillTextarea]);

  return (
    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', paddingRight: 2 }}>
      <ActionBtn onClick={handleCopy} title="复制">
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M3 8l3 3 7-7" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="4" y="4" width="9" height="11" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M3 12V3h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        )}
      </ActionBtn>
      <ActionBtn onClick={handleResend} title="重新发送">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M2 8a6 6 0 0111.3-3M14 8a6 6 0 01-9.3 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <polygon points="14,4 14,1 17,4" fill="currentColor" transform="translate(-2,2) scale(0.7)" />
        </svg>
      </ActionBtn>
      <ActionBtn onClick={handleAddToContext} title="添加到对话">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </ActionBtn>
    </div>
  );
}

function ActionBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={title}
      style={{
        background: hovered ? 'var(--bg-tertiary)' : 'transparent',
        border: 'none', borderRadius: 4,
        color: hovered ? 'var(--text-primary)' : 'var(--text-secondary)',
        cursor: 'pointer', padding: 3,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
        opacity: hovered ? 1 : 0.5,
      }}
    >
      {children}
    </button>
  );
}

const MessageBubble = React.memo(function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';
  const hasThinking = !isUser && !!message.thinkingContent;
  const hasContent = !!message.content;
  const showContentBubble = isUser || !hasThinking || hasContent;

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexDirection: isUser ? 'row-reverse' : 'row' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: isUser ? 'var(--accent)' : 'linear-gradient(135deg, #6366f1, #7c3aed)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, flexShrink: 0, color: '#fff', fontWeight: 600,
      }}>
        <img src={isUser ? '/assets/head.png' : '/assets/logo.png'} alt={isUser ? 'user' : 'ai'} style={{ width: 28, height: 28, borderRadius: '50%' }} />
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
        {isUser && <UserActions message={message} />}
      </div>
    </div>
  );
});

export default MessageBubble;
