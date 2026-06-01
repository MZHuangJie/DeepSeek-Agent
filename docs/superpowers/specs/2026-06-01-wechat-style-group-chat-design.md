# WeChat 风格群聊系统 — 设计文档

> 日期：2026-06-01 | 状态：已确认

## 1. 概述

将现有 Chat Sessions 面板改造为微信风格的会话列表，支持群聊功能。每个角色独立调用 LLM 发言，由导演 AI 调度，不再由主模型一人总结。

### 1.1 核心目标

1. **微信风格 ChatList**：头像 + 会话名 + 最后消息预览
2. **NPC 群聊**：角色扮演 NPC 组成群聊，场景驱动、剧情推进
3. **Agent 群聊**：Agent 角色组成群聊，任务驱动、问题协作
4. **导演调度**：独立小模型做导演，判断谁发言、何时结束
5. **统一框架**：Conversation 统一 solo/group_npc/group_agent

### 1.2 关键约束

- NPC 和 Agent **不能混在同一个群**（NPC = 娱乐，Agent = 工作生产）
- 用户可以随时打断群聊发言
- 群聊自然结束（导演判断），有 maxRounds 上限保护

---

## 2. 数据模型

### 2.1 ConversationType

```typescript
type ConversationType = 'solo' | 'group_npc' | 'group_agent';
// solo:       一对一对话（普通 AI 或绑定单个角色）
// group_npc:  群聊，成员全部是 RoleplayCharacter (NPC)
// group_agent: 群聊，成员全部是 AgentRole
```

### 2.2 ConversationMember

```typescript
interface ConversationMember {
  roleId: string;           // AgentRole.id 或 RoleplayCharacter.id
  roleType: 'agent' | 'npc';
  name: string;
  avatar?: string;          // 头像路径或 dataUrl
  modelId?: string;         // 该成员使用的模型，缺省用主模型
  systemPrompt: string;
}
```

### 2.3 DriverConfig

```typescript
interface DriverConfig {
  mode: 'simple' | 'director';
  // simple:   用户 ↔ AI 交替（solo 模式）
  // director: 导演 AI 调度（group 模式）
  directorModel?: ModelConfig;  // 导演专用模型，缺省用独立小模型
  maxRounds?: number;           // 最大轮次保护，默认 8
}
```

### 2.4 Conversation

```typescript
interface Conversation {
  id: string;
  type: ConversationType;
  title: string;              // solo: 自动摘要, group: 用户命名
  avatar?: string;            // solo: AI/角色头像, group: 合成群头像
  members: ConversationMember[];
  messages: Message[];
  lastMessage?: {
    text: string;
    senderName?: string;      // group 时显示 "谁说的"
    timestamp: number;
  };
  driver: DriverConfig;
  createdAt: number;
  updatedAt: number;

  // 向后兼容（从旧 Session 迁移，新代码不应直接使用）
  characterId?: string;
  characterIds?: string[];
  planTodos?: PlanTodo[];
  planDocPath?: string;
  pendingOpening?: boolean;
  sessionMode?: 'roleplay';
}
```

### 2.5 Message 扩展

在现有 Message 接口上新增三个可选字段：

```typescript
interface Message {
  // ... 现有字段不变 ...
  senderId?: string;       // 群聊发言者 roleId
  senderName?: string;     // 群聊发言者名称（冗余，加速渲染）
  senderAvatar?: string;   // 群聊发言者头像
}
```

---

## 3. 导演 AI 与消息流转 Pipeline

### 3.1 完整流程

```
用户发消息
  → buildGroupContext() 拼接上下文
  → 导演 AI 判断 { action: "speak"|"end", nextSpeaker, reason }
  → action="speak": 调用角色 API 流式生成发言
      → 推送 GroupChunk 到渲染进程
      → 追加到上下文
      → 回到导演继续判断
  → action="end": 群聊结束
```

### 3.2 导演 AI Prompt 设计

- **输出格式**：纯 JSON `{ "action": "speak" | "end", "nextSpeaker": "成员名", "reason": "简短理由" }`
- **调度规则**：
  1. 优先让与最新消息最相关的成员发言
  2. 避免同一成员连续发言超过 2 次
  3. 用户（玩家）不可被调度
  4. 问题充分讨论 / 情境自然推进 → action: "end"
- **上下文包含**：群聊成员列表（名称+简介+职责/性格）、完整对话历史

### 3.3 NPC vs Agent 导演差异

| 维度 | NPC 群聊 | Agent 群聊 |
|------|----------|------------|
| 调度目标 | 推进剧情/场景 | 解决问题/完成任务 |
| 结束条件 | 情境自然推进完毕 | 问题已充分讨论 |
| 发言风格 | 角色性格驱动 | 专业职责驱动 |
| 上下文注入 | 角色背景+性格 | 角色职责+项目信息 |

### 3.4 用户打断

1. 用户输入 → `AbortController.abort()`
2. 取消当前角色流式请求
3. 清空导演待调度队列
4. 以用户新消息为上下文重新开始导演循环
5. 已生成的消息保留，未完成的丢弃

### 3.5 Pipeline 伪代码

```typescript
async function runGroupLoop(
  conv: Conversation,
  userMsg: string,
  onChunk: (data: GroupChunk) => void,
  signal: AbortSignal
) {
  const ctx = buildGroupContext(conv);
  let round = 0;

  while (round < conv.driver.maxRounds) {
    if (signal.aborted) break;

    const decision = await askDirector(ctx, conv.members, conv.type, signal);
    if (decision.action === 'end') break;

    const speaker = findMember(conv.members, decision.nextSpeaker);
    if (!speaker) continue;

    onChunk({ type: 'typing', speaker });

    const reply = await streamCharacterReply(
      speaker, ctx,
      (text) => onChunk({ type: 'text', speaker, text }),
      signal
    );

    ctx.push({ speaker: speaker.name, content: reply });
    onChunk({ type: 'message-done', speaker, reply });
    round++;
  }

  onChunk({ type: 'group-done' });
}
```

---

## 4. UI 设计

### 4.1 ChatList（替换 SessionList）

```
ChatList
├── SearchBar              # 搜索过滤会话
├── ConversationItem[]     # 每条会话行
│   ├── Avatar             # solo: 单头像, group: 2×2 拼接头像
│   ├── Title + TypeBadge  # 会话名 + 🎭NPC / 💼Agent 标签
│   ├── LastMsgPreview     # group 显示 "发言人: 内容"
│   └── TimeBadge          # 相对时间
└── CreateGroupButtons     # 底部两个按钮
    ├── 🎭 新建 NPC 群聊
    └── 💼 新建 Agent 群聊
```

### 4.2 ConversationItem 布局

- 左侧头像（40×40，圆形，group 用 2×2 网格）
- 中间：标题行 + 最后消息预览行（单行截断）
- 右侧：相对时间
- Group 类型显示对应标签徽章

### 4.3 建群流程

1. 点击 "新建 NPC 群聊" 或 "新建 Agent 群聊"
2. 弹出角色选择器（按类型过滤）
3. 多选勾选成员（至少 2 人）
4. 设置群名（可留空自动生成）
5. 创建成功 → 自动生成开场消息

### 4.4 群聊消息渲染

- **新组件 `GroupMessageBubble`**：头像（左）+ 名称 + 气泡，类似微信
- 用户自己的消息右对齐（蓝色气泡）
- 角色消息左对齐（灰色气泡）
- **`TypingIndicator`**："XXX 正在输入..." 带三个点动画
- 群聊进行中 ChatInput 始终可用（可打断）

### 4.5 ChatWorkspace 顶部改造

现有 `SessionTabs` 标签栏移除。ChatWorkspace 顶部改为简单的标题栏：
- Solo 会话：显示会话标题 + 模式标签（Plan/Agent/Chat）
- Group 会话：显示群名 + 🎭NPC 或 💼Agent 徽章 + 成员数

### 4.6 ChatPanel 自适应

- `conversation.type === 'solo'`：使用现有 `MessageBubble`，保持所有现有功能（thinking、tool calls、roleplay 等）
- `conversation.type === 'group_npc' | 'group_agent'`：使用 `GroupMessageBubble` + `TypingIndicator`
- Solo 和 Group 在同一个 ChatPanel 内渲染，根据 type 切换组件
- Solo 的 roleplay 模式（单角色绑定）继续走现有 `buildHistory → invokeAgent` 流程，不受影响

---

## 5. Store 设计

### 5.1 conversationStore.ts（新建，由 chatStore 重构）

```typescript
interface ConversationState {
  conversations: Conversation[];
  activeId: string | null;
  isStreaming: boolean;

  loadAll: () => Promise<void>;
  createSolo: () => void;
  createGroup: (type: 'group_npc' | 'group_agent', members: ConversationMember[], name?: string) => void;
  switchTo: (id: string) => void;
  delete: (id: string) => void;
  addMessage: (msg: Message) => void;
  updateLastMessage: (update: Partial<Message>) => void;
  setStreaming: (v: boolean) => void;

  // 迁移
  migrateFromSessions: () => Promise<void>;
}
```

### 5.2 groupChatStore.ts（新建，群聊专用状态）

```typescript
interface GroupChatState {
  activeSpeaker: string | null;       // 当前正在发言的角色
  typingMap: Record<string, boolean>; // 谁在输入中
  isGroupActive: boolean;             // 群聊是否进行中
  abortController: AbortController | null;

  startGroupChat: (convId: string) => void;
  stopGroupChat: () => void;
  setTyping: (speakerId: string, typing: boolean) => void;
}
```

### 5.3 向后兼容

- 旧 `chatStore` 保留，内部包装 `conversationStore`
- 旧组件通过适配层继续工作
- 过渡期结束后移除适配层

---

## 6. 数据迁移

### 6.1 迁移策略

1. 启动时检查是否存在旧 Session 数据（`sessions:*` key）
2. 检查 `_migrated_v2` flag，已迁移则跳过
3. 对每条 Session 推断 type：
   - 有 `characterIds` 且 ≥2 → `group_npc`
   - 有 `characterId` → `solo`
   - 其他 → `solo`
4. 转换 Message 数组（内容不变）
5. 写入新 `conversations:*` key
6. 写入 `_migrated_v2` flag

### 6.2 Key 变更

| 旧 Key | 新 Key | 说明 |
|--------|--------|------|
| `sessions:*` | `conversations:*` | 每条 conversation 独立存储 |
| `window.api.sessions.*` | `window.api.conversations.*` | IPC 通道名称更新 |
| n/a | `_migrated_v2` | 迁移标记 |

---

## 7. 主进程改造

### 7.1 新增文件

| 文件 | 用途 |
|------|------|
| `src/main/agent/groupDirector.ts` | 导演调度核心：askDirector、runGroupLoop、buildGroupContext |
| `src/main/agent/characterSpeaker.ts` | 角色发言：streamCharacterReply、buildCharacterContext |
| `src/main/ipc/conversation.ts` | Conversation CRUD IPC handler |
| `src/main/ipc/groupChat.ts` | 群聊 IPC handler |

### 7.2 IPC 通道

| 方向 | 通道 | 用途 |
|------|------|------|
| R→M | `conversation:send-group` | 发送群聊消息 |
| R→M | `conversation:cancel-group` | 打断群聊 |
| M→R | `conversation:group-chunk` | 群聊流式事件 |
| R→M | `conversation:save` | 保存 conversation |
| R→M | `conversation:load-all` | 加载全部 |
| R→M | `conversation:delete` | 删除 |

### 7.3 GroupChunk 事件类型

```typescript
type GroupChunk =
  | { type: 'director-thinking' }                              // 导演判断中
  | { type: 'typing', speaker: MemberInfo }                    // XXX 正在输入
  | { type: 'text', speaker: MemberInfo, text: string }        // 流式文本
  | { type: 'message-done', speaker: MemberInfo, reply: string } // 消息完成
  | { type: 'group-done' }                                     // 群聊结束
  | { type: 'error', message: string }                         // 错误
```

### 7.4 Solo 流程不变

现有 `agent:send → streamChat() → onStreamChunk → ChatPanel` 完全不变。群聊走独立 pipeline。

---

## 8. 文件变更清单

### 新建文件

- `src/renderer/stores/conversationStore.ts`
- `src/renderer/stores/groupChatStore.ts`
- `src/renderer/components/sidebar/ChatList.tsx`
- `src/renderer/components/sidebar/ChatList.module.css`
- `src/renderer/components/chat/GroupMessageBubble.tsx`
- `src/renderer/components/chat/GroupMessageBubble.module.css`
- `src/renderer/components/chat/TypingIndicator.tsx`
- `src/renderer/components/chat/CreateGroupDialog.tsx`
- `src/renderer/components/chat/CreateGroupDialog.module.css`
- `src/main/agent/groupDirector.ts`
- `src/main/agent/characterSpeaker.ts`
- `src/main/ipc/conversation.ts`
- `src/main/ipc/groupChat.ts`

### 修改文件

- `src/renderer/stores/chat.ts` — 添加适配层
- `src/renderer/App.tsx` — SessionList → ChatList
- `src/renderer/components/chat/ChatWorkspace.tsx` — 群聊感知
- `src/renderer/components/chat/ChatPanel.tsx` — 自适应 solo/group 渲染
- `src/renderer/components/sidebar/ActivityBar.tsx` — 面板名称更新
- `src/main/ipc/index.ts` — 注册新 IPC handler
- `src/main/agent/tools/index.ts` — 可选，未来群聊工具

### 逐步废弃

- `src/renderer/components/sidebar/SessionList.tsx` — 被 ChatList 替代
- `src/renderer/components/chat/SessionTabs.tsx` — 被 ChatList 内联替代
- `src/renderer/stores/chat.ts` — 适配层最终移除

---

## 9. 已决事项（默认策略）

以下问题在设计中已给出默认决策，实现时按此执行：

- **导演模型**：默认使用当前主模型（`getActiveModel()`）。用户可在 DriverConfig 中指定独立模型。不引入额外的模型配置复杂度。
- **群聊开场**：导演生成一段场景描述（NPC 群）或任务摘要（Agent 群），然后自然判断第一个发言者。开场消息触发的首个 turn 不消耗 maxRounds 计数。
- **群头像合成**：取前 4 个成员头像拼 2×2 网格。成员无头像时用名称首字作为占位（类似微信默认头像）。若只有一个成员头像，使用单头像。
- **Solo 角色扮演不变**：现有 roleplay 模式（单 NPC 绑定 solo conversation）完全不受影响，继续走 `buildHistory → invokeAgent` 流程。
