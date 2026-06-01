// src/main/agent/groupDirector.ts
import type { Conversation, ConversationMember, MemberInfo, GroupChunk } from '../../common/conversation';
import { streamCharacterReply } from './characterSpeaker';
import { streamChat } from './client';
import type { ChatMessage } from './types';

function buildDirectorSystemPrompt(
  members: ConversationMember[],
  groupType: string,
  spokenMembers: Set<string>,
): string {
  const memberList = members.map(m => {
    const hasSpoken = spokenMembers.has(m.name) ? '（已发言）' : '（未发言）';
    return `- ${m.name}${hasSpoken}：${m.systemPrompt ? m.systemPrompt.slice(0, 200) : (m.roleType === 'npc' ? '角色扮演 NPC' : 'Agent 角色')}`;
  }).join('\n');

  const goalText = groupType === 'group_npc'
    ? '推进剧情/场景，维持角色人设，让对话自然流动'
    : '协作解决问题/完成任务，让讨论逐步深入';

  const spokenList = spokenMembers.size > 0
    ? `已发言成员：${Array.from(spokenMembers).join('、')}`
    : '暂无成员发言';

  return `你是群聊的导演（Director）。根据对话上下文判断下一步由哪个成员发言，或对话是否自然结束。

## 群聊成员
${memberList}

## 当前状态
${spokenList}

## 规则（严格遵循）
1. 只输出 JSON，不要任何其他内容
2. 优先让与最新消息最相关的成员发言
3. **绝对禁止同一成员连续发言**
4. **每个成员在本次用户提问后的讨论中最多发言 1 次**，优先选择尚未发言的成员
5. 如果所有成员都已发言过，或话题已充分推进，输出 action: "end"
6. 用户不是你可以调度的对象
7. ${goalText}

## 输出格式
{ "action": "speak" | "end", "nextSpeaker": "成员名", "reason": "简短理由" }`;
}

function buildDirectorMessages(
  context: Array<{ speaker: string; content: string }>,
  userMessage: string,
): ChatMessage[] {
  // 限制上下文长度，只保留最近 6 条发言
  const recentContext = context.slice(-6);
  const ctxStr = recentContext.map(c => `[${c.speaker}]: ${c.content.slice(0, 400)}`).join('\n');
  const prompt = ctxStr
    ? `对话历史：\n${ctxStr}\n\n用户最新消息："${userMessage}"\n\n判断下一步。注意：已发言过的成员本轮不应再次发言。`
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
  const spokenMembers = new Set<string>();
  let round = 0;
  const maxRounds = Math.min(conv.driver.maxRounds || 8, conv.members.length);

  while (round < maxRounds) {
    if (signal.aborted) break;

    // 1. Director decision
    onChunk({ type: 'director-thinking' });
    const directorSystemPrompt = buildDirectorSystemPrompt(conv.members, conv.type, spokenMembers);
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
    if (!speaker) {
      round++;
      continue;
    }

    // Safety: if this member already spoke, force end to prevent repetition
    if (spokenMembers.has(speaker.name)) {
      // If there are still unspoken members, let director retry is too complex;
      // just end the loop to avoid repetition
      break;
    }

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
      spokenMembers.add(speaker.name);
      onChunk({ type: 'message-done', speaker: memberInfo, reply });
    } catch (err) {
      onChunk({ type: 'error', message: err instanceof Error ? err.message : '角色发言失败' });
      break;
    }

    round++;
  }

  onChunk({ type: 'group-done' });
}
