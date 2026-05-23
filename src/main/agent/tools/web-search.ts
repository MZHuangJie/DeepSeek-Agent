import { webSearch } from '../services/webSearch';
import type { ToolDef } from './index';

export function createWebSearchTool(): ToolDef {
  return {
    name: 'web_search', description: '搜索互联网获取最新信息',
    parameters: { type: 'object', properties: { query: { type: 'string' }, maxResults: { type: 'number' } }, required: ['query'] },
    execute: async (args) => {
      const results = await webSearch(args.query as string, (args.maxResults as number) || 8);
      if (results.length === 0) return JSON.stringify({ error: '未找到相关结果' });
      return JSON.stringify({ query: args.query, results });
    },
  };
}
