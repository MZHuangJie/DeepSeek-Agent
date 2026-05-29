// 角色分派 — spawn_role_agents 工具（Multi-Agent 模式专用）
// 参数: assignments: [{ role_id, task, target_path? }]
// 把子任务分派给用户预定义的角色，每个角色使用独立 system prompt 与模型并行执行
import type { SubAgentTask } from '../sub-agent';
import { formatSubAgentResultsForTool } from '../sub-agent';
import { safeResolve } from './security';
import type { ToolDef, ToolContext } from './index';

export function createSpawnRoleAgentsTool(projectDir: string): ToolDef {
  return {
    name: 'spawn_role_agents',
    description: '把子任务分派给已配置的角色代理并行执行。每个角色使用自己的职责 prompt 与模型，适合把任务拆给不同专长的角色协作。',
    parameters: {
      type: 'object',
      properties: {
        assignments: {
          type: 'array',
          description: '分派列表，每项指定一个角色与其负责的子任务',
          items: {
            type: 'object',
            properties: {
              role_id: { type: 'string', description: '角色 ID（来自已配置的角色库）' },
              task: { type: 'string', description: '该角色需要完成的具体子任务描述' },
              target_path: { type: 'string', description: '相关的目标路径（相对项目根目录，可选）' },
            },
            required: ['role_id', 'task'],
          },
        },
      },
      required: ['assignments'],
    },
    execute: async (args, context) => {
      const { subAgentManager, apiKey, modelConfig, contextMax, signal, multiAgentRoles } = context as ToolContext;
      if (!subAgentManager) throw new Error('spawn_role_agents 需要 subAgentManager');

      const roles = multiAgentRoles ?? [];
      if (roles.length === 0) {
        return '【系统提示】当前没有配置任何 Multi-Agent 角色。请提示用户前往「系统设置 → Multi-Agent 角色」中创建角色后再分派任务。';
      }

      const assignments = Array.isArray(args.assignments) ? (args.assignments as any[]) : [];
      if (assignments.length === 0) {
        return '【系统提示】assignments 为空，未分派任何任务。';
      }

      const tasks: SubAgentTask[] = [];
      const displayItems: Array<{ targetPath: string }> = [];
      const unknownRoles: string[] = [];

      assignments.forEach((a, idx) => {
        const role = roles.find(r => r.id === a.role_id);
        if (!role) {
          unknownRoles.push(String(a.role_id));
          return;
        }
        const relPath = (a.target_path as string) || '.';
        tasks.push({
          id: `role-${role.id}-${Date.now()}-${idx}`,
          type: 'implement',
          description: `【角色：${role.name}】\n${a.task}`,
          targetPath: safeResolve(projectDir, relPath),
          projectDir,
          roleName: role.name,
          systemPromptOverride: role.systemPrompt,
          modelConfigOverride: { model: role.modelConfig.model, baseUrl: role.modelConfig.baseUrl },
          apiKeyOverride: role.modelConfig.apiKey,
        });
        displayItems.push({ targetPath: `${role.name} @ ${relPath}` });
      });

      if (tasks.length === 0) {
        return `【系统提示】未匹配到任何有效角色（无效 role_id: ${unknownRoles.join(', ')}）。可用角色：${roles.map(r => `${r.name}(${r.id})`).join('、')}`;
      }

      const results = await subAgentManager.spawnMultipleSubAgents(
        tasks, apiKey, modelConfig, contextMax, signal,
      );

      let output = formatSubAgentResultsForTool(displayItems, results);
      if (unknownRoles.length > 0) {
        output += `\n\n【提示】以下 role_id 无效已忽略：${unknownRoles.join(', ')}`;
      }
      return output;
    },
  };
}
