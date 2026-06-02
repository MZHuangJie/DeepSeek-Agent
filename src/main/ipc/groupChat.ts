// src/main/ipc/groupChat.ts
import { ipcMain, BrowserWindow } from 'electron';
import { streamCharacterReply } from '../agent/characterSpeaker';
import type { Conversation, GroupChunk } from '../../common/conversation';
import { getApiKey } from '../security/keystore';

const activeControllers = new Map<string, AbortController>();

function extractMentions(message: string, members: Conversation['members']): typeof members {
  const mentioned = new Set<string>();
  const re = /@(\S+?)(?:\s|$|[，。！？,.!?])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(message)) !== null) {
    mentioned.add(m[1]);
  }
  if (mentioned.size === 0) return [];
  return members.filter(m => mentioned.has(m.name));
}

export function setupGroupChatHandlers() {
  ipcMain.handle('group-chat:send', async (event, conversationJson: string, userMessage: string) => {
    const conv: Conversation = JSON.parse(conversationJson);
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('未配置 API Key');

    const existing = activeControllers.get(conv.id);
    if (existing) existing.abort();

    const controller = new AbortController();
    activeControllers.set(conv.id, controller);

    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) throw new Error('找不到窗口');

    const directorModelConfig = conv.driver.directorModel || {
      model: 'deepseek-chat',
      baseUrl: 'https://api.deepseek.com/v1',
    };

    const onChunk = (data: GroupChunk) => {
      if (win.isDestroyed()) return;
      win.webContents.send('group-chat:chunk', conv.id, data);
    };

    try {
      // 解析 @mention，只让被 @ 的人发言
      const targets = extractMentions(userMessage, conv.members);

      if (targets.length === 0) {
        // 没有 @ 任何人：发给全员讨论
        for (const speaker of conv.members) {
          if (controller.signal.aborted) break;
          const memberInfo = { roleId: speaker.roleId, name: speaker.name, avatar: speaker.avatar };
          onChunk({ type: 'typing', speaker: memberInfo });
          try {
            const reply = await streamCharacterReply(
              speaker.systemPrompt,
              context,
              userMessage,
              { model: directorModelConfig.model, baseUrl: directorModelConfig.baseUrl, apiKey },
              (text) => onChunk({ type: 'text', speaker: memberInfo, text }),
              controller.signal,
            );
            context.push({ speaker: speaker.name, content: reply });
            onChunk({ type: 'message-done', speaker: memberInfo, reply });
          } catch (err) {
            onChunk({ type: 'error', message: `${speaker.name} 发言失败: ${err instanceof Error ? err.message : String(err)}` });
          }
        }
      } else {
        const context: Array<{ speaker: string; content: string }> = [];
        for (const speaker of targets) {
          if (controller.signal.aborted) break;
          const memberInfo = { roleId: speaker.roleId, name: speaker.name, avatar: speaker.avatar };
          onChunk({ type: 'typing', speaker: memberInfo });

          try {
            const reply = await streamCharacterReply(
              speaker.systemPrompt,
              context,
              userMessage,
              { model: directorModelConfig.model, baseUrl: directorModelConfig.baseUrl, apiKey },
              (text) => onChunk({ type: 'text', speaker: memberInfo, text }),
              controller.signal,
            );
            context.push({ speaker: speaker.name, content: reply });
            onChunk({ type: 'message-done', speaker: memberInfo, reply });
          } catch (err) {
            onChunk({ type: 'error', message: `${speaker.name} 发言失败: ${err instanceof Error ? err.message : String(err)}` });
          }
        }
      }
    } catch (err) {
      onChunk({ type: 'error', message: err instanceof Error ? err.message : '群聊异常' });
    } finally {
      onChunk({ type: 'group-done' });
      activeControllers.delete(conv.id);
    }
  });

  ipcMain.handle('group-chat:cancel', async (_event, convId: string) => {
    const controller = activeControllers.get(convId);
    if (controller) {
      controller.abort();
      activeControllers.delete(convId);
    }
    return { success: true };
  });
}
