/**
 * 智能压缩工具调用结果
 * 保留关键信息（第一行摘要、文件路径），而不是简单掐头去尾
 */
export function compressToolResult(content: string, maxLen: number = 300): string {
  if (content.length <= maxLen) return content;

  const lines = content.split('\n');
  const firstLine = lines[0];

  // 提取文件路径信息
  const pathMatches = content.match(/[\w\/\.\-\\]+\.\w{1,6}/g) || [];
  const uniquePaths = [...new Set(pathMatches)].filter(p => p.includes('/') || p.includes('\\'));

  const parts: string[] = [firstLine];

  if (uniquePaths.length > 0) {
    parts.push(`涉及文件: ${uniquePaths.slice(0, 5).join(', ')}`);
  }

  // 保留最后几行（可能包含错误信息）
  const lastLines = lines.slice(-2).filter(l => l.trim());
  if (lastLines.length > 0 && !parts.some(p => p.includes(lastLines[0]))) {
    parts.push(`...${lastLines.join('\n')}`);
  }

  const result = parts.join('\n');
  if (result.length < content.length) {
    return result + `\n...[已压缩，原长度 ${content.length} 字符]`;
  }
  return result;
}
