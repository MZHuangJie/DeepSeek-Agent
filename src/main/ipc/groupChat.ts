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

/** 找到消息历史中最后一位发言的角色，没有则返回第一个成员 */
function findLastSpeaker(conv: Conversation): Conversation['members'][number] | undefined {
  const { messages, members } = conv;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'assistant' && msg.senderId) {
      return members.find(m => m.roleId === msg.senderId);
    }
  }
  return members[0];
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
      model: 'deepseek-v4-flash',
      baseUrl: 'https://api.deepseek.com/v1',
    };

    const onChunk = (data: GroupChunk) => {
      if (win.isDestroyed()) return;
      win.webContents.send('group-chat:chunk', conv.id, data);
    };

    try {
      // 解析 @mention：有 @ 则只让被 @ 的角色发言，否则默认跟上一轮发言的角色对话
      const targets = extractMentions(userMessage, conv.members);
      const speakers = targets.length > 0 ? targets : [findLastSpeaker(conv)].filter(Boolean) as typeof conv.members;
      const context: Array<{ speaker: string; content: string }> = [];
      let totalPrompt = 0, totalCompletion = 0, totalTokens = 0;
      let totalCacheHit = 0, totalCacheMiss = 0;

      for (const speaker of speakers) {
        if (controller.signal.aborted) break;
        const memberInfo = { roleId: speaker.roleId, name: speaker.name, avatar: speaker.avatar };
        onChunk({ type: 'typing', speaker: memberInfo });
        try {
          const result = await streamCharacterReply(
            speaker.systemPrompt,
            context,
            userMessage,
            { model: directorModelConfig.model, baseUrl: directorModelConfig.baseUrl, apiKey },
            (text) => onChunk({ type: 'text', speaker: memberInfo, text }),
            controller.signal,
          );
          context.push({ speaker: speaker.name, content: result.text });
          onChunk({ type: 'message-done', speaker: memberInfo, reply: result.text });
          if (result.usage) {
            totalPrompt += result.usage.prompt_tokens;
            totalCompletion += result.usage.completion_tokens;
            totalTokens += result.usage.total_tokens;
            totalCacheHit += result.usage.prompt_cache_hit_tokens ?? 0;
            totalCacheMiss += result.usage.prompt_cache_miss_tokens ?? 0;
          }
        } catch (err) {
          onChunk({ type: 'error', message: `${speaker.name} 发言失败: ${err instanceof Error ? err.message : String(err)}` });
        }
      }

      // 发送汇总 token 用量（含缓存命中/未命中）
      if (totalTokens > 0) {
        onChunk({
          type: 'usage',
          usage: {
            prompt: totalPrompt, completion: totalCompletion, total: totalTokens,
            promptCacheHit: totalCacheHit || undefined,
            promptCacheMiss: totalCacheMiss || undefined,
            modelName: directorModelConfig.model,
          },
        });
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
