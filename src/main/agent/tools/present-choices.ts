import { ipcMain } from 'electron';
import type { ToolDef } from './index';

export function createPresentChoicesTool(): ToolDef {
  return {
    name: 'present_choices', description: '弹出选项列表让用户多选',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        choices: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, description: { type: 'string' } }, required: ['label'] } },
      },
      required: ['message', 'choices'],
    },
    execute: async (args, context) => {
      const win = (context as any)?.subAgentManager?.win;
      if (!win || win.isDestroyed()) return JSON.stringify({ error: '无法弹出选择框' });
      const choiceId = `choice-${Date.now()}`;
      const result = await new Promise<any>((resolve) => {
        let cleaned = false;
        const cleanup = () => { if (!cleaned) { cleaned = true; ipcMain.removeListener('agent:choice-response', handler); context?.signal?.removeEventListener('abort', onAbort); } };
        const handler = (_e: any, r: any) => { if (r.choiceId === choiceId) { cleanup(); resolve(r); } };
        const onAbort = () => { cleanup(); resolve({ cancelled: true }); };
        ipcMain.on('agent:choice-response', handler);
        context?.signal?.addEventListener('abort', onAbort, { once: true });
        win.webContents.send('agent:choice-request', { choiceId, message: args.message, choices: args.choices });
      });
      if (result.cancelled) return JSON.stringify({ cancelled: true });
      const selectedLabels = ((args.choices as any[]) || []).filter((_, i) => result.selected?.includes(i)).map(c => c.label);
      return JSON.stringify({ selected: result.selected, selectedLabels, feedback: result.feedback || '' });
    },
  };
}
