// src/main/agent/groupDirector.ts
import type { Conversation, ConversationMember, MemberInfo, GroupChunk } from '../../common/conversation';
import { streamCharacterReply } from './characterSpeaker';
import { streamChat } from './client';
import type { ChatMessage } from './types';

function buildDirectorSystemPrompt(
  members: ConversationMember[],
  groupType: string,
  spokenMembers: Set<string>,
  round: number,
): string {
  const memberList = members.map(m => {
    const roleHint = m.roleType === 'agent'
      ? `角色：${m.name}${m.systemPrompt ? ' — ' + m.systemPrompt.slice(0, 150) : ''}`
      : `NPC：${m.name}，设定：${m.systemPrompt?.slice(0, 100) || '角色扮演'}`;
    return `- ${roleHint}`;
  }).join('\n');

  const historyNote = spokenMembers.size > 0
    ? `本轮已发言：${Array.from(spokenMembers).join('、')}（共 ${spokenMembers.size}/${members.length} 人已发言）`
    : '本轮刚开始，所有人尚未发言';

  return `你是群聊的调度导演。你的目标是组织一场**真正的协作讨论**，而不是让每个人轮流独白。

## 群成员
${memberList}

## 状态
${historyNote} | 当前是第 ${round + 1} 轮调度

## 调度规则
1. 只输出 JSON：{ "action": "speak" | "end", "nextSpeaker": "成员名", "reason": "简短理由" }
2. **协作优先**：后续发言者应回应、补充或质疑前人的发言，而不是自顾自输出
3. **用户参与**：如果有需要用户决策的问题（如方案确认、设计方向），调度合适的人向用户提问，然后 action: "end" 等待用户回复
4. **自然顺序**：产品/策划类角色优先发言定方向，设计类其次，工程类最后。但可以交叉讨论
5. **允许重复发言**：成员可以在后续轮次再次发言（如回应他人观点），不限制每人一次
6. **不要抢话**：同一成员绝对不能连续两轮发言
7. **适时结束**：如果问题已充分讨论、需要用户决策、或对话陷入循环，果断 action: "end"
8. 本轮已发言超过 ${Math.ceil(members.length * 0.8)} 人且讨论充分 → 结束
9. 每轮只调度一个人发言，让他完整表达后再调度下一个`;
}

function buildDirectorMessages(
  context: Array<{ speaker: string; content: string }>,
  userMessage: string,
): ChatMessage[] {
  const recentContext = context.slice(-8);
  const ctxStr = recentContext.map(c => `[${c.speaker}]: ${c.content.slice(0, 500)}`).join('\n');
  const prompt = ctxStr
    ? `对话历史：\n${ctxStr}\n\n用户说："${userMessage}"\n\n根据讨论进展判断：下一步应该由谁发言来推进讨论？需要有人回应、补充、或向用户提问吗？还是讨论已经充分可以结束了？`
    : `用户说："${userMessage}"\n\n这是讨论的开始。判断谁应该第一个发言来引导讨论方向。`;

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
  const maxRounds = Math.max(conv.driver.maxRounds || 8, conv.members.length * 2);

  while (round < maxRounds) {
    if (signal.aborted) break;

    // 1. Director decision
    onChunk({ type: 'director-thinking' });
    const directorSystemPrompt = buildDirectorSystemPrompt(conv.members, conv.type, spokenMembers, round);
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

    // Safety: prevent same speaker twice in a row (not across rounds)
    const lastSpeaker = context.length > 0 ? context[context.length - 1].speaker : null;
    if (lastSpeaker === speaker.name) {
      round++;
      continue;
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
