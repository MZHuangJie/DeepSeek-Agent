import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Message } from '../../stores/chat';
import { useRefsStore } from '../../stores/refs';
import ThinkingChain from './ThinkingChain';
import shared from '../../styles/components.module.css';
import styles from './MessageBubble.module.css';

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
    <button onClick={handleCopy} className={shared.copyBtn} style={{ color: copied ? '#22c55e' : undefined }}>
      {copied ? '✓ 已复制' : '📋 复制链接'}
    </button>
  );
}

function isImageUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (/\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/.test(lower)) return true;
  if (lower.startsWith('data:image/')) return true;
  // 仅匹配已知生图 CDN 的域名，避免把普通链接误判成图片
  if (
    lower.includes('oaidalleapiprodscus.blob.core.windows.net') ||
    lower.includes('cdn.openai.com') ||
    lower.includes('files.oaiusercontent.com')
  ) return true;
  return false;
}

function ImageCard({ url, alt }: { url: string; alt: string }) {
  const [loaded, setLoaded] = useState(true);
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    setLoaded(true);
    if (/^[A-Za-z]:[\\/]/.test(url)) {
      window.api.files.readBinary(url).then(setResolved).catch(() => setLoaded(false));
    } else {
      setResolved(url);
    }
  }, [url]);

  const src = resolved || url;

  if (!loaded) {
    return (
      <div className={styles.imageWrap}>
        <a href={url} target="_blank" rel="noopener noreferrer" className={styles.imageLink}>
          {alt || '图片链接'}
        </a>
        <div style={{ marginTop: 4 }}>
          <CopyButton text={url} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.imageWrap}>
      <img
        src={src}
        alt={alt}
        className={styles.image}
        onClick={() => window.open(url, '_blank')}
        onError={() => setLoaded(false)}
      />
      <div className={styles.imageMeta}>
        <CopyButton text={url} />
        <span className={styles.imageHint}>点击图片可在新标签页打开</span>
      </div>
    </div>
  );
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
  if (parts.length === 0) return <span className={styles.textWrap}>{text}</span>;
  return (
    <>
      {parts.map((p, i) =>
        p.type === 'text'
          ? <span key={i} className={styles.textWrap}>{p.value}</span>
          : <span key={i} className={styles.atChip}>@{p.path}</span>
      )}
    </>
  );
}

function MessageContent({ content }: { content: string }) {
  const parts = useMemo(() => parseMarkdown(content), [content]);

  if (parts.length === 1 && parts[0].type === 'text') {
    if (isImageUrl(content.trim()) || content.trim().startsWith('data:image/')) {
      return <ImageCard url={content.trim()} alt="" />;
    }
    return <div className={styles.textWrap}><RichText text={content} /></div>;
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
              className={styles.link}
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
  const isError = tc.status === 'error';

  const statusColor = isRunning ? 'var(--accent)' : isError ? '#ef4444' : '#22c55e';
  const bgColor = isRunning ? 'rgba(124,58,237,0.06)' : isError ? 'rgba(239,68,68,0.06)' : 'rgba(34,197,94,0.04)';

  return (
    <div className={styles.toolCard} style={{ background: bgColor, border: `1px solid ${statusColor}20` }}>
      <div className={styles.toolHeader} onClick={() => setExpanded(!expanded)}>
        <span style={{ color: statusColor }}>{expanded ? '▼' : '▶'}</span>
        {isRunning ? (
          <span className={styles.spinner} style={{ borderColor: `${statusColor}40`, borderTopColor: statusColor }} />
        ) : isSuccess(tc) ? (
          <svg width="12" height="12" viewBox="0 0 16 16"><path d="M3 8l3 3 7-7" stroke="#22c55e" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 16 16"><path d="M8 1v10M4 6l4 4 4-4" stroke="#ef4444" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><circle cx="8" cy="14" r="1" fill="#ef4444"/></svg>
        )}
        <span className={styles.toolName}>{tc.name}</span>
        {isRunning && <span className={styles.toolStatus} style={{ color: 'var(--text-secondary)' }}>执行中...</span>}
        {isSuccess(tc) && <span className={styles.toolStatus} style={{ color: '#22c55e' }}>完成</span>}
        {isError && <span className={styles.toolStatus} style={{ color: '#ef4444' }}>失败</span>}
      </div>
      {expanded && (
        <div className={styles.toolBody} style={{ borderTop: `1px solid ${statusColor}20` }}>
          <div className={styles.toolBodySection}>
            <div className={styles.toolLabel}>请求参数：</div>
            <pre className={`${styles.toolPre} ${styles.toolPreSm}`}>
              {JSON.stringify(tc.args, null, 2)}
            </pre>
          </div>
          {tc.result && (
            <div>
              <div className={styles.toolLabel}>返回数据：</div>
              <pre className={`${styles.toolPre} ${styles.toolPreLg}`}>
                {tc.result.length > 2000 ? tc.result.slice(0, 2000) + '\n...[已截断]...' : tc.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function isSuccess(tc: import('../../stores/chat').ToolCall): boolean {
  return tc.status === 'success';
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
    setTimeout(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>('textarea[placeholder*="Ask DeepSeek"]');
      textarea?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
    }, 50);
  }, [message.content, fillTextarea]);

  const handleAddToContext = useCallback(() => {
    useRefsStore.getState().addTextRef(message.content);
  }, [message.content]);

  return (
    <div className={styles.actions} style={{ opacity: visible ? 1 : 0 }}>
      <ActionBtn onClick={handleCopy} title="复制">
        <img src="/assets/file.png" alt="复制" className={styles.actionIcon} />
      </ActionBtn>
      <ActionBtn onClick={handleResend} title="重新发送">
        <img src="/assets/refresh.png" alt="重新发送" className={styles.actionIcon} />
      </ActionBtn>
      <ActionBtn onClick={handleAddToContext} title="添加到对话">
        <img src="/assets/add.png" alt="添加到对话" className={styles.actionIcon} />
      </ActionBtn>
    </div>
  );
}

function ActionBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return <button onClick={onClick} title={title} className={shared.actionBtn}>{children}</button>;
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
      className={styles.wrapper}
      style={{ flexDirection: isUser ? 'row-reverse' : 'row' }}
    >
      <div className={`${styles.avatar} ${isUser ? styles.avatarUser : styles.avatarAi}`}>
        <img src={isUser ? '/assets/head.png' : '/assets/ai_avater.png'} alt={isUser ? 'user' : 'ai'} className={styles.avatarImg} />
      </div>
      <div className={styles.contentWrap}>
        {hasThinking && (
          <ThinkingChain text={message.thinkingContent!} hasContent={hasContent} />
        )}

        <ToolCallProgress toolCalls={message.toolCalls} />

        {showContentBubble && (
          <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleAi}`}>
            <MessageContent content={message.content || '...'} />
          </div>
        )}

        {isUser && <UserActions message={message} visible={actionsVisible} />}
      </div>
    </div>
  );
});

export default MessageBubble;
