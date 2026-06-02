import { describe, it, expect } from 'vitest';
import type { Conversation, Message, ConversationMember } from '../conversation';

// 测试 conversation 类型的结构和序列化兼容性
// parseConversationPayload 在 conversationStore.ts 中，但类型定义在 common/

function simulateSerializeThenParse(conv: Partial<Conversation>): any {
  // 模拟 serializeConversation 的行为
  const payload = JSON.stringify({
    messages: conv.messages || [],
    members: conv.members || [],
    type: conv.type || 'solo',
    driver: conv.driver || { mode: 'simple', maxRounds: 8 },
    lastMessage: conv.lastMessage,
    characterId: conv.characterId,
    characterIds: conv.characterIds,
    planTodos: conv.planTodos,
    planDocPath: conv.planDocPath,
    pendingOpening: conv.pendingOpening,
    sessionMode: conv.sessionMode,
  });
  return JSON.parse(payload);
}

describe('Conversation serialization roundtrip', () => {
  it('preserves solo conversation fields', () => {
    const conv: Partial<Conversation> = {
      type: 'solo',
      messages: [
        { id: 'msg-1', role: 'user', content: 'hello', timestamp: 1000 },
      ],
      driver: { mode: 'simple', maxRounds: 8 },
    };
    const parsed = simulateSerializeThenParse(conv);
    expect(parsed.type).toBe('solo');
    expect(parsed.messages).toHaveLength(1);
    expect(parsed.messages[0].content).toBe('hello');
  });

  it('preserves group_npc conversation fields', () => {
    const members: ConversationMember[] = [
      { roleId: 'char-1', roleType: 'npc', name: '小明', systemPrompt: '我是小明' },
    ];
    const conv: Partial<Conversation> = {
      type: 'group_npc',
      members,
      driver: { mode: 'director', maxRounds: 8, directorModel: { model: 'gpt-4', baseUrl: 'https://api.openai.com' } },
      characterIds: ['char-1'],
    };
    const parsed = simulateSerializeThenParse(conv);
    expect(parsed.type).toBe('group_npc');
    expect(parsed.members).toHaveLength(1);
    expect(parsed.members[0].name).toBe('小明');
    expect(parsed.characterIds).toEqual(['char-1']);
  });

  it('preserves group_agent conversation fields', () => {
    const members: ConversationMember[] = [
      { roleId: 'agent-1', roleType: 'agent', name: '审查员', modelId: 'gpt-4', systemPrompt: '审查代码' },
    ];
    const conv: Partial<Conversation> = {
      type: 'group_agent',
      members,
    };
    const parsed = simulateSerializeThenParse(conv);
    expect(parsed.type).toBe('group_agent');
    expect(parsed.members[0].roleType).toBe('agent');
    expect(parsed.members[0].systemPrompt).toBe('审查代码');
  });

  it('preserves plan todos', () => {
    const conv: Partial<Conversation> = {
      planTodos: [
        { id: '1', text: 'Task 1', completed: false },
        { id: '2', text: 'Task 2', completed: true },
      ],
    };
    const parsed = simulateSerializeThenParse(conv);
    expect(parsed.planTodos).toHaveLength(2);
    expect(parsed.planTodos[1].completed).toBe(true);
  });

  it('preserves roleplay session mode', () => {
    const conv: Partial<Conversation> = {
      type: 'solo',
      sessionMode: 'roleplay',
      characterId: 'char-1',
      pendingOpening: true,
    };
    const parsed = simulateSerializeThenParse(conv);
    expect(parsed.sessionMode).toBe('roleplay');
    expect(parsed.characterId).toBe('char-1');
    expect(parsed.pendingOpening).toBe(true);
  });

  it('handles empty conversation gracefully', () => {
    const parsed = simulateSerializeThenParse({});
    expect(parsed.type).toBe('solo');
    expect(parsed.messages).toEqual([]);
    expect(parsed.members).toEqual([]);
    expect(parsed.driver).toEqual({ mode: 'simple', maxRounds: 8 });
  });
});
