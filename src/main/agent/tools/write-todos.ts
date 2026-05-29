// 任务清单 — write_todos 工具
// Plan 模式写完计划文档后输出可执行的任务清单；执行阶段也用它更新各项状态（实时勾选）
// 实际的前端同步由 ipc/agent.ts 在工具调用后转发 plan-todos 事件完成
import type { ToolDef } from './index';

export type PlanTodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface NormalizedPlanTodo {
  id: string;
  content: string;
  status: PlanTodoStatus;
}

const VALID_STATUS: PlanTodoStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'];

/** 规范化工具入参中的 todos：补全 id 与默认 status */
export function normalizePlanTodos(raw: unknown): NormalizedPlanTodo[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, idx): NormalizedPlanTodo | null => {
      if (!item || typeof item !== 'object') return null;
      const obj = item as Record<string, unknown>;
      const content = typeof obj.content === 'string' ? obj.content.trim() : '';
      if (!content) return null;
      const status = VALID_STATUS.includes(obj.status as PlanTodoStatus)
        ? (obj.status as PlanTodoStatus)
        : 'pending';
      const id = typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : `todo-${idx + 1}`;
      return { id, content, status };
    })
    .filter((t): t is NormalizedPlanTodo => t !== null);
}

export function createWriteTodosTool(): ToolDef {
  return {
    name: 'write_todos',
    description: '输出/更新可执行的任务清单（待办列表）。Plan 模式写完计划文档后调用以生成任务清单；执行阶段每完成一项就再次调用，传入完整列表并更新对应项的 status，实现进度勾选。',
    parameters: {
      type: 'object',
      properties: {
        todos: {
          type: 'array',
          description: '完整的任务清单（每次都传全量列表，不是增量）',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: '任务稳定 ID（更新状态时需保持一致）' },
              content: { type: 'string', description: '任务描述' },
              status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'], description: '任务状态' },
            },
            required: ['content'],
          },
        },
        plan_doc_path: { type: 'string', description: '关联的计划文档路径（可选，如 docs/plans/xxx.md）' },
      },
      required: ['todos'],
    },
    execute: async (args) => {
      const todos = normalizePlanTodos((args as Record<string, unknown>).todos);
      if (todos.length === 0) {
        return '未解析到有效的任务项。请确保 todos 为非空数组，且每项含 content。';
      }
      const done = todos.filter(t => t.status === 'completed').length;
      return `已记录任务清单（${todos.length} 项，已完成 ${done} 项）。`;
    },
  };
}
