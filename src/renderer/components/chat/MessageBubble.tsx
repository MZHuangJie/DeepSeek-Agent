import React, { useState, useCallback } from 'react';
import { Message } from '../../stores/chat';
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

function MessageContent({ content }: { content: string }) {
  const parts = parseMarkdown(content);

  if (parts.length === 1 && parts[0].type === 'text') {
    return <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{content}</div>;
  }

  return (
    <div style={{ wordBreak: 'break-word' }}>
      {parts.map((part, idx) => {
        if (part.type === 'text') {
          return <span key={idx} style={{ whiteSpace: 'pre-wrap' }}>{part.text}</span>;
        }
        if (part.type === 'image') {
          return (
            <div key={idx} style={{ margin: '8px 0' }}>
              <img
                src={part.url}
                alt={part.alt}
                style={{
                  maxWidth: '100%',
                  maxHeight: 400,
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  display: 'block',
                  cursor: 'pointer',
                }}
                onClick={() => window.open(part.url, '_blank')}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <CopyButton text={part.url} />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  点击图片可在新标签页打开
                </span>
              </div>
            </div>
          );
        }
        if (part.type === 'link') {
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

export default function MessageBubble({ message }: Props) {
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
        <img src={isUser ? '/assets/4.png' : '/assets/logo.png'} alt={isUser ? 'user' : 'ai'} style={{ width: 28, height: 28, borderRadius: '50%' }} />
      </div>
      <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* 1. Thinking chain displayed above content for AI messages */}
        {hasThinking && (
          <ThinkingChain text={message.thinkingContent!} hasContent={hasContent} />
        )}

        {/* 2. Response content bubble rendered after thinking is done */}
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
      </div>
    </div>
  );
}
