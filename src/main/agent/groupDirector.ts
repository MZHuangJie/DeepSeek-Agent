// src/main/agent/groupDirector.ts
import type { Conversation, ConversationMember, MemberInfo, GroupChunk } from '../../common/conversation';
import { streamCharacterReply } from './characterSpeaker';
import { streamChat } from './client';
import type { ChatMessage } from './types';

function buildDirectorSystemPrompt(members: ConversationMember[], groupType: string): string {
  const memberList = members.map(m =>
    `- ${m.name}：${m.systemPrompt ? m.systemPrompt.slice(0, 200) : (m.roleType === 'npc' ? '角色扮演 NPC' : 'Agent 角色')}`
  ).join('\n');

  const goalText = groupType === 'group_npc'
    ? '推进剧情/场景，维持角色人设，让对话自然流动'
    : '协作解决问题/完成任务，让讨论逐步深入';

  return `你是群聊的导演（Director）。根据对话上下文判断下一步由哪个成员发言，或对话是否自然结束。

## 群聊成员
${memberList}

## 规则
1. 只输出 JSON，不要任何其他内容
2. 优先让与最新消息最相关的成员发言
3. 禁止同一成员连续发言，上一个刚发言的成员本轮不能再次发言
4. 用户不是你可以调度的对象
5. ${goalText}
6. 如果话题已充分推进或问题已讨论清楚，输出 action: "end"

## 输出格式
{ "action": "speak" | "end", "nextSpeaker": "成员名", "reason": "简短理由" }`;
}

function buildDirectorMessages(
  context: Array<{ speaker: string; content: string }>,
  userMessage: string,
): ChatMessage[] {
  const ctxStr = context.map(c => `[${c.speaker}]: ${c.content}`).join('\n');
  const prompt = ctxStr
    ? `对话历史：\n${ctxStr}\n\n用户最新消息："${userMessage}"\n\n判断下一步。`
    : `用户消息："${userMessage}"\n\n这是群聊第一轮，请判断第一个发言的成员。`;

  return [{ role: 'user', content: prompt }];
}

export async function runGroupLoop(
  conv: Conversation,
  userMessage: string,
  onChunk: (data: GroupChunk) => void,
  signal: AbortSignal,
  apiKey: string,
  directorModelConfig: { model: string; baseUrl: string },
) {
  const context: Array<{ speaker: string; content: string }> = [];
  let round = 0;
  const maxRounds = conv.driver.maxRounds || 8;

  while (round < maxRounds) {
    if (signal.aborted) break;

    // 1. Director decision
    onChunk({ type: 'director-thinking' });
    const directorSystemPrompt = buildDirectorSystemPrompt(conv.members, conv.type);
    const directorMessages = buildDirectorMessages(context, userMessage);

    let decision: { action: 'speak' | 'end'; nextSpeaker?: string; reason?: string };
    try {
      const result = await streamChat(
        apiKey,
        [
          { role: 'system', content: directorSystemPrompt },
          ...directorMessages,
        ],
        [],
        directorModelConfig,
        {
          onContent: () => {},
          onThinking: () => {},
        },
        signal,
      );

      try {
        const jsonMatch = result.content.match(/\{[\s\S]*\}/);
        decision = jsonMatch ? JSON.parse(jsonMatch[0]) : { action: 'end' };
      } catch {
        decision = { action: 'end' };
      }
    } catch {
      decision = { action: 'end' };
    }

    if (decision.action === 'end' || !decision.nextSpeaker) break;

    // 2. Find speaker
    const speaker = conv.members.find(m => m.name === decision.nextSpeaker);
    if (!speaker) continue;

    const memberInfo: MemberInfo = {
      roleId: speaker.roleId,
      name: speaker.name,
      avatar: speaker.avatar,
    };

    // 3. Notify frontend
    onChunk({ type: 'typing', speaker: memberInfo });

    // 4. Call character API
    const speakerModelConfig = {
      model: directorModelConfig.model,
      baseUrl: directorModelConfig.baseUrl,
      apiKey,
    };

    try {
      const reply = await streamCharacterReply(
        speaker.systemPrompt,
        context,
        userMessage,
        speakerModelConfig,
        (text) => onChunk({ type: 'text', speaker: memberInfo, text }),
        signal,
      );

      context.push({ speaker: speaker.name, content: reply });
      onChunk({ type: 'message-done', speaker: memberInfo, reply });
    } catch (err) {
      onChunk({ type: 'error', message: err instanceof Error ? err.message : '角色发言失败' });
      break;
    }

    round++;
  }

  onChunk({ type: 'group-done' });
}
