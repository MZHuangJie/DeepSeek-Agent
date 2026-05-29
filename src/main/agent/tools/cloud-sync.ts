import { cloudListSessions, cloudGetSession, cloudPushSession } from '../../services/syncClient';
import { loadSessions, saveSession } from '../../db/sessions';

export function createCloudListSessionsTool() {
  return {
    name: 'cloud_list_sessions',
    description: '列出用户已备份到云端的所有会话摘要（id、标题、消息数、更新时间）。未登录时返回错误。',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: async () => {
      const result = await cloudListSessions();
      if (!result.success) {
        return `错误：${result.error}`;
      }
      if (!result.sessions || result.sessions.length === 0) {
        return '云端暂无备份的会话。';
      }
      const lines = result.sessions.map(s => {
        const date = s.updatedAt ? new Date(s.updatedAt).toLocaleString('zh-CN') : '未知时间';
        return `- [${s.id}] "${s.title}"（${s.messageCount} 条消息，${date}）`;
      });
      return `云端会话列表（共 ${result.sessions.length} 个）：\n${lines.join('\n')}`;
    },
  };
}

export function createCloudPushSessionTool() {
  return {
    name: 'cloud_push_session',
    description: '将本地会话备份到云端。必须提供 session_id。',
    parameters: {
      type: 'object',
      properties: {
        session_id: {
          type: 'string',
          description: '本地会话 ID（必填）',
        },
      },
      required: ['session_id'],
    },
    execute: async (args: Record<string, unknown>) => {
      const sessionId = args.session_id as string;
      const sessions = loadSessions();
      const local = sessions.find(s => s.id === sessionId);
      if (!local) {
        return `错误：本地会话 ${sessionId} 不存在。`;
      }
      const result = await cloudPushSession(sessionId, local.title, local.messages);
      if (!result.success) {
        return `错误：${result.error}`;
      }
      return `会话 "${local.title}" 已成功备份到云端。`;
    },
  };
}

export function createCloudPullSessionTool() {
  return {
    name: 'cloud_pull_session',
    description: '从云端拉取指定会话到本地。如果本地已存在同名会话，会覆盖更新。',
    parameters: {
      type: 'object',
      properties: {
        session_id: {
          type: 'string',
          description: '云端会话 ID（必填）',
        },
      },
      required: ['session_id'],
    },
    execute: async (args: Record<string, unknown>) => {
      const sessionId = args.session_id as string;
      const result = await cloudGetSession(sessionId);
      if (!result.success) {
        return `错误：${result.error}`;
      }
      if (!result.session) {
        return '错误：云端会话数据为空。';
      }
      const { title, payload } = result.session;
      saveSession(sessionId, title, payload);
      return `会话 "${title}" 已从云端拉取到本地。`;
    },
  };
}
