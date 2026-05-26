import type { Message } from '../stores/chat';

export function extractPlainUserText(message: Pick<Message, 'content' | 'contentParts'>): string {
  if (message.contentParts?.length) {
    const text = message.contentParts
      .filter(part => part.type === 'text' && part.text)
      .map(part => part.text!.trim())
      .join(' ')
      .trim();
    if (text) return text;
  }
  return message.content.trim();
}

export function deriveFallbackSessionTitle(raw: string): string {
  let text = raw
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '[图片]')
    .replace(/^\/[\w-]+\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text || text === '（图片）' || text === '[图片]') return '图片对话';

  const sentence = text.match(/^[^。！？.!?\n]{1,60}/)?.[0]?.trim() ?? text;
  const cleaned = sentence.replace(/[。！？.!?…]+$/g, '').trim();
  const title = cleaned || text;
  return title.length > 28 ? `${title.slice(0, 28)}…` : title;
}

export function displaySessionTitle(title: string): string {
  const cleaned = title
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '[图片]')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || '新建会话';
}
