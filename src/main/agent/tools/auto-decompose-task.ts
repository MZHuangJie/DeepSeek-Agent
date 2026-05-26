// 自动任务分解 — auto_decompose_task 工具
// 参数: user_query(用户查询)
// >50文件自动触发子代理并行探索
import { TaskDecomposer } from '../task-decomposer';
import { formatSubAgentResultsForTool } from '../sub-agent';
import type { ToolDef, ToolContext } from './index';

export function createAutoDecomposeTaskTool(projectDir: string): ToolDef {
  return {
    name: 'auto_decompose_task',
    description: '自动分析项目并决定是否需要分解为多个子代理任务',
    parameters: { type: 'object', properties: { user_query: { type: 'string' } }, required: ['user_query'] },
    execute: async (args, context) => {
      const { subAgentManager, apiKey, modelConfig, contextMax, signal } = context as ToolContext;
      if (!subAgentManager) throw new Error('auto_decompose_task 需要 subAgentManager');

      const decomposer = new TaskDecomposer();
      const strategy = await decomposer.analyzeAndDecompose(projectDir, args.user_query as string);

      if (!strategy.shouldDecompose) return `不需要分解: ${strategy.reason}\n建议直接使用现有工具探索。`;

      const results = await subAgentManager.spawnMultipleSubAgents(
        strategy.tasks, apiKey, modelConfig, contextMax, signal,
      );
      return `自动分解完成: ${strategy.reason}\n执行了 ${strategy.tasks.length} 个子任务:\n\n${formatSubAgentResultsForTool(strategy.tasks, results)}`;
    },
  };
}
