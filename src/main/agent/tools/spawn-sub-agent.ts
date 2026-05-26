// 子代理生成 — spawn_sub_agent 工具
// 参数: task_type, description, target_path
// 支持并行子代理，独立上下文窗口
import type { SubAgentTask } from '../sub-agent';
import { safeResolve } from './security';
import type { ToolDef, ToolContext } from './index';

export function createSpawnSubAgentTool(projectDir: string): ToolDef {
  return {
    name: 'spawn_sub_agent',
    description: '生成子代理处理特定任务。当项目规模较大或需要并行探索多个模块时使用。',
    parameters: {
      type: 'object',
      properties: {
        task_type: { type: 'string', enum: ['explore', 'analyze', 'implement', 'review'] },
        description: { type: 'string' },
        target_path: { type: 'string' },
        parallel_tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: { task_type: { type: 'string', enum: ['explore', 'analyze', 'implement', 'review'] }, description: { type: 'string' }, target_path: { type: 'string' } },
            required: ['task_type', 'description', 'target_path'],
          },
        },
      },
      required: ['task_type', 'description', 'target_path'],
    },
    execute: async (args, context) => {
      const { subAgentManager, apiKey, modelConfig, contextMax } = context as ToolContext;
      if (!subAgentManager) throw new Error('spawn_sub_agent 需要 subAgentManager');

      if (args.parallel_tasks && Array.isArray(args.parallel_tasks)) {
        const tasks = (args.parallel_tasks as any[]).map((t, idx) => ({
          id: `manual-${t.task_type}-${Date.now()}-${idx}`,
          type: t.task_type as any, description: t.description, targetPath: safeResolve(projectDir, t.target_path as string), projectDir,
        }));
        const results = await subAgentManager.spawnMultipleSubAgents(tasks, apiKey, modelConfig, contextMax);
        return results.map((r: any, idx: number) => `${r.success ? '✓' : '✗'} ${tasks[idx].targetPath}: ${r.filesProcessed.length} 文件, ${r.tokenUsage.total} tokens\n${r.summary}`).join('\n\n---\n\n');
      }

      const task: SubAgentTask = {
        id: `manual-${args.task_type}-${Date.now()}`,
        type: args.task_type as any, description: args.description as string,
        targetPath: safeResolve(projectDir, args.target_path as string), projectDir,
      };
      const result = await subAgentManager.spawnSubAgent(task, apiKey, modelConfig, contextMax);
      if (!result.success) return `子代理执行失败: ${result.error}`;
      return `子代理执行成功: ${task.targetPath}\n处理文件: ${result.filesProcessed.length}\nToken: ${result.tokenUsage.total}\n\n${result.summary}`;
    },
  };
}
