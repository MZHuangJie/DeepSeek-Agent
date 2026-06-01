# WeChat 风格群聊系统 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 Chat Sessions 面板改造为微信风格会话列表，新增 NPC 群聊和 Agent 群聊功能，每个角色由导演 AI 调度独立发言。

**Architecture:** 统一 Conversation 框架（`solo` / `group_npc` / `group_agent`），新增 conversationStore + groupChatStore，ChatList 替换 SessionList，后端新增 groupDirector + characterSpeaker 模块，独立 IPC 通道。

**Tech Stack:** TypeScript, React, Zustand, Electron IPC, CSS Modules

**Spec:** [2026-06-01-wechat-style-group-chat-design.md](../specs/2026-06-01-wechat-style-group-chat-design.md)

---

## Phase 1: 共享类型 + Store 基础

### Task 1: 创建共享 Conversation 类型定义

**Files:**
- Create: `src/common/conversation.ts`

- [ ] **Step 1: 写入 Conversation 类型定义**

```typescript
// src/common/conversation.ts
// 共享于 main 和 renderer 进程的 Conversation 类型

import type { PlanTodo } from '../renderer/stores/chat';

export type ConversationType = 'solo' | 'group_npc' | 'group_agent';

export interface ConversationMember {
  roleId: string;
  roleType: 'agent' | 'npc';
  name: string;
  avatar?: string;
  modelId?: string;
  systemPrompt: string;
}

export interface DriverConfig {
  mode: 'simple' | 'director';
  directorModel?: { model: string; baseUrl: string };
  maxRounds: number; // 默认 8
}

export interface LastMessagePreview {
  text: string;
  senderName?: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  title: string;
  avatar?: string;
  members: ConversationMember[];
  messages: Message[];
  lastMessage?: LastMessagePreview;
  driver: DriverConfig;
  createdAt: number;
  updatedAt: number;
  // 向后兼容
  characterId?: string;
  characterIds?: string[];
  planTodos?: PlanTodo[];
  planDocPath?: string;
  pendingOpening?: boolean;
  sessionMode?: 'roleplay';
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  contentParts?: Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>;
  thinkingContent?: string;
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result?: string;
    timestamp: number;
    status: 'running' | 'success' | 'error';
  }>;
  roleplayMeta?: Record<string, unknown>;
  rawContent?: string;
  timestamp: number;
  // 群聊扩展
  senderId?: string;
  senderName?: string;
  senderAvatar?: string;
}

export interface GroupChunk {
  type: 'director-thinking' | 'typing' | 'text' | 'message-done' | 'group-done' | 'error';
  speaker?: { roleId: string; name: string; avatar?: string };
  text?: string;
  reply?: string;
  message?: string; // for error type
}

export interface MemberInfo {
  roleId: string;
  name: string;
  avatar?: string;
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit src/common/conversation.ts`
Expected: no errors (may have module resolution issues — ok if resolved later)

- [ ] **Step 3: Commit**

```bash
git add src/common/conversation.ts
git commit -m "feat: add shared Conversation type definitions"
```

---

### Task 2: 创建后端 Conversation 持久化层

**Files:**
- Create: `src/main/db/conversation.ts`
- Modify: `src/main/db/connection.ts` — 添加 conversations 表

- [ ] **Step 1: 在 MemDb 中添加 conversations 表**

Edit `src/main/db/connection.ts` — 在 `initSchema()` 中添加新表（在 sessions 表创建之后）：

```typescript
// 在 initSchema() 函数中，sessions 表创建之后添加：
db!.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);
```

同时在 MemDb 的 `run` 和 `all` 方法中添加 `conversations` 的处理逻辑（参照 sessions 的处理方式）。

- [ ] **Step 2: 创建 conversation 持久化模块**

```typescript
// src/main/db/conversation.ts
import { getDatabase } from './connection';

export function saveConversation(id: string, title: string, payload: string) {
  const db = getDatabase();
  db.run(
    `INSERT OR REPLACE INTO conversations (id, title, payload, created_at, updated_at)
     VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
    [id, title, payload]
  );
}

export function loadAllConversations(): Array<{ id: string; title: string; payload: string }> {
  const db = getDatabase();
  return db.all('SELECT id, title, payload FROM conversations ORDER BY updated_at DESC');
}

export function deleteConversation(id: string) {
  const db = getDatabase();
  db.run('DELETE FROM conversations WHERE id = ?', [id]);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/main/db/conversation.ts src/main/db/connection.ts
git commit -m "feat: add conversation persistence layer"
```

---

### Task 3: 创建 conversation IPC handler

**Files:**
- Create: `src/main/ipc/conversation.ts`
- Modify: `src/main/ipc/index.ts` — 注册新 handler

- [ ] **Step 1: 创建 IPC handler**

```typescript
// src/main/ipc/conversation.ts
import { ipcMain } from 'electron';
import { saveConversation, loadAllConversations, deleteConversation } from '../db/conversation';

export function setupConversationHandlers() {
  ipcMain.handle('conversations:save', async (_event, id: string, title: string, payload: string) => {
    saveConversation(id, title, payload);
    return { success: true };
  });

  ipcMain.handle('conversations:loadAll', async () => {
    return loadAllConversations();
  });

  ipcMain.handle('conversations:delete', async (_event, id: string) => {
    deleteConversation(id);
    return { success: true };
  });

  ipcMain.handle('conversations:getMigrated', async () => {
    const db = (await import('../db/connection')).getDatabase();
    try {
      const rows = db.all("SELECT value FROM settings WHERE key = '_migrated_v2'");
      return rows.length > 0;
    } catch {
      return false;
    }
  });

  ipcMain.handle('conversations:setMigrated', async () => {
    const db = (await import('../db/connection')).getDatabase();
    db.run(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('_migrated_v2', '1')"
    );
    return { success: true };
  });
}
```

- [ ] **Step 2: 在 ipc/index.ts 中注册**

```typescript
// 在 registerAllHandlers() 中添加:
import { setupConversationHandlers } from './conversation';
// ...
setupConversationHandlers();
```

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc/conversation.ts src/main/ipc/index.ts
git commit -m "feat: add conversation IPC handlers"
```

---

### Task 4: 扩展 preload API + 类型声明

**Files:**
- Modify: `src/preload/index.ts` — 添加 conversations API
- Modify: `src/renderer/types.d.ts` — 添加类型声明

- [ ] **Step 1: 在 preload 中添加 conversations API**

在 `src/preload/index.ts` 的 contextBridge 中添加（在 `sessions` 之后）：

```typescript
conversations: {
  save: (id: string, title: string, payload: string) => ipcRenderer.invoke('conversations:save', id, title, payload),
  loadAll: () => ipcRenderer.invoke('conversations:loadAll'),
  delete: (id: string) => ipcRenderer.invoke('conversations:delete', id),
  getMigrated: () => ipcRenderer.invoke('conversations:getMigrated'),
  setMigrated: () => ipcRenderer.invoke('conversations:setMigrated'),
},
```

- [ ] **Step 2: 在 types.d.ts 中添加类型**

```typescript
conversations: {
  save: (id: string, title: string, payload: string) => Promise<{ success: boolean }>;
  loadAll: () => Promise<Array<{ id: string; title: string; payload: string }>>;
  delete: (id: string) => Promise<{ success: boolean }>;
  getMigrated: () => Promise<boolean>;
  setMigrated: () => Promise<{ success: boolean }>;
};
```

- [ ] **Step 3: Commit**

```bash
git add src/preload/index.ts src/renderer/types.d.ts
git commit -m "feat: add conversations preload API"
```

---

### Task 5: 创建 conversationStore

**Files:**
- Create: `src/renderer/stores/conversationStore.ts`

- [ ] **Step 1: 写入完整 store**

```typescript
// src/renderer/stores/conversationStore.ts
import { create } from 'zustand';
import type { Conversation, ConversationMember, ConversationType, Message, DriverConfig } from '../../common/conversation';
import { useRoleplayStore } from './roleplay';
import { useModeStore } from './mode';
import { useAgentRolesStore } from './agentRoles';

let soloCounter = 0;

function findMaxSoloCounter(convs: Conversation[]): number {
  return convs.reduce((max, c) => {
    const match = c.title.match(/会话 #(\d+)/);
    return match ? Math.max(max, parseInt(match[1])) : max;
  }, 0);
}

function serializeConversation(conv: Conversation): string {
  return JSON.stringify({
    messages: conv.messages,
    members: conv.members,
    type: conv.type,
    driver: conv.driver,
    lastMessage: conv.lastMessage,
    characterId: conv.characterId,
    characterIds: conv.characterIds,
    planTodos: conv.planTodos,
    planDocPath: conv.planDocPath,
    pendingOpening: conv.pendingOpening,
    sessionMode: conv.sessionMode,
  });
}

function parseConversationPayload(raw: string): {
  messages: Message[];
  members: ConversationMember[];
  type: ConversationType;
  driver: DriverConfig;
  lastMessage?: Conversation['lastMessage'];
  characterId?: string;
  characterIds?: string[];
  planTodos?: Conversation['planTodos'];
  planDocPath?: string;
  pendingOpening?: boolean;
  sessionMode?: 'roleplay';
} {
  try {
    const parsed = JSON.parse(raw);
    return {
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      members: Array.isArray(parsed.members) ? parsed.members : [],
      type: parsed.type || 'solo',
      driver: parsed.driver || { mode: 'simple', maxRounds: 8 },
      lastMessage: parsed.lastMessage,
      characterId: parsed.characterId,
      characterIds: parsed.characterIds,
      planTodos: Array.isArray(parsed.planTodos) ? parsed.planTodos : undefined,
      planDocPath: parsed.planDocPath,
      pendingOpening: parsed.pendingOpening,
      sessionMode: parsed.sessionMode === 'dzmm' ? 'roleplay' : parsed.sessionMode,
    };
  } catch {
    return { messages: [], members: [], type: 'solo', driver: { mode: 'simple', maxRounds: 8 } };
  }
}

function persistConversation(conv: Conversation) {
  window.api.conversations.save(conv.id, conv.title, serializeConversation(conv));
}

function persistAll(convs: Conversation[]) {
  for (const c of convs) persistConversation(c);
}

interface ConversationState {
  conversations: Conversation[];
  activeId: string | null;
  isStreaming: boolean;

  loadAll: () => Promise<void>;
  migrateFromSessions: () => Promise<void>;
  createSolo: () => void;
  createGroup: (type: 'group_npc' | 'group_agent', members: ConversationMember[], name?: string) => Conversation | null;
  switchTo: (id: string) => void;
  delete: (id: string) => void;
  addMessage: (msg: Message) => void;
  updateLastAssistant: (update: Partial<Message>, convId?: string) => void;
  newAssistantMessage: (convId?: string) => void;
  setStreaming: (v: boolean) => void;
  updateTitle: (id: string, title: string) => void;

  webPreviewHtml: string | null;
  webPreviewFile: string | null;
  setWebPreviewHtml: (html: string | null) => void;
  setWebPreviewFile: (file: string | null) => void;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  activeId: null,
  isStreaming: false,
  webPreviewHtml: null,
  webPreviewFile: null,

  loadAll: async () => {
    try {
      const raw = await window.api.conversations.loadAll();
      if (raw && Array.isArray(raw)) {
        const conversations: Conversation[] = raw.map((r: any) => {
          const payload = parseConversationPayload(r.payload);
          return {
            id: r.id,
            title: r.title,
            type: payload.type,
            avatar: undefined,
            members: payload.members,
            messages: payload.messages,
            lastMessage: payload.lastMessage,
            driver: payload.driver,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            characterId: payload.characterId,
            characterIds: payload.characterIds,
            planTodos: payload.planTodos,
            planDocPath: payload.planDocPath,
            pendingOpening: payload.pendingOpening,
            sessionMode: payload.sessionMode,
          };
        });
        if (conversations.length > 0) {
          soloCounter = findMaxSoloCounter(conversations.filter(c => c.type === 'solo'));
          const currentActive = get().activeId;
          if (currentActive === null || !conversations.find(c => c.id === currentActive)) {
            set({ conversations, activeId: conversations[0].id });
          } else {
            set({ conversations });
          }
        }
      }
    } catch { /* empty on load failure */ }
  },

  migrateFromSessions: async () => {
    try {
      const alreadyMigrated = await window.api.conversations.getMigrated();
      if (alreadyMigrated) return;
    } catch { /* proceed with migration */ }

    try {
      const raw = await window.api.sessions.loadAll();
      if (!raw || !Array.isArray(raw) || raw.length === 0) return;

      for (const s of raw) {
        const parsed = (() => {
          try {
            const p = JSON.parse(s.messages);
            return {
              messages: Array.isArray(p) ? p : Array.isArray(p?.messages) ? p.messages : [],
              characterId: p?.characterId,
              characterIds: p?.characterIds,
              planTodos: p?.planTodos,
              planDocPath: p?.planDocPath,
              pendingOpening: p?.pendingOpening,
              sessionMode: p?.sessionMode,
            };
          } catch { return { messages: [] }; }
        })();

        const hasMultiChars = parsed.characterIds && parsed.characterIds.length >= 2;
        const type: ConversationType = hasMultiChars ? 'group_npc' : 'solo';

        const payload = JSON.stringify({
          messages: parsed.messages,
          members: [],
          type,
          driver: { mode: type === 'solo' ? 'simple' : 'director', maxRounds: 8 },
          characterId: parsed.characterId,
          characterIds: parsed.characterIds,
          planTodos: parsed.planTodos,
          planDocPath: parsed.planDocPath,
          pendingOpening: parsed.pendingOpening,
          sessionMode: parsed.sessionMode,
        });

        await window.api.conversations.save(s.id, s.title, payload);
      }

      await window.api.conversations.setMigrated();
      // 迁移后重新加载
      await get().loadAll();
    } catch { /* migration failure is non-fatal */ }
  },

  createSolo: () => {
    soloCounter++;
    const conv: Conversation = {
      id: `conv-${Date.now()}`,
      type: 'solo',
      title: `会话 #${soloCounter}`,
      members: [],
      messages: [],
      driver: { mode: 'simple', maxRounds: 8 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set(s => ({
      conversations: [conv, ...s.conversations],
      activeId: conv.id,
    }));
    persistConversation(conv);
  },

  createGroup: (type, members, name) => {
    if (members.length < 2) return null;
    const conv: Conversation = {
      id: `conv-${Date.now()}`,
      type,
      title: name || (type === 'group_npc' ? 'NPC 群聊' : 'Agent 群聊'),
      members,
      messages: [],
      driver: { mode: 'director', maxRounds: 8 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set(s => ({
      conversations: [conv, ...s.conversations],
      activeId: conv.id,
    }));
    persistConversation(conv);
    return conv;
  },

  switchTo: (id) => {
    set({ activeId: id, webPreviewHtml: null, webPreviewFile: null });
    const conv = get().conversations.find(c => c.id === id);
    if (conv && conv.sessionMode === 'roleplay') {
      useModeStore.getState().setMode('roleplay');
    }
  },

  delete: (id) => {
    window.api.conversations.delete(id);
    const { activeId, conversations } = get();
    const newConvs = conversations.filter(c => c.id !== id);
    set({
      conversations: newConvs,
      activeId: activeId === id ? (newConvs[0]?.id ?? null) : activeId,
    });
  },

  addMessage: (msg) => {
    const { activeId, conversations, isStreaming } = get();
    let modified: Conversation | null = null;
    const newConvs = conversations.map(c => {
      if (c.id !== activeId) return c;
      const newMessages = [...c.messages, msg];
      const lastMsg = newMessages[newMessages.length - 1];
      const lastMessage = lastMsg ? {
        text: lastMsg.content?.slice(0, 100) || '',
        senderName: lastMsg.senderName,
        timestamp: lastMsg.timestamp,
      } : undefined;
      modified = { ...c, messages: newMessages, lastMessage, updatedAt: Date.now() };
      return modified;
    });
    const ordered = modified
      ? newConvs.map(c => c.id === activeId ? modified! : c)
      : newConvs;
    set({ conversations: ordered });
    if (!isStreaming) persistAll(ordered);
  },

  updateLastAssistant: (update, convId?) => {
    const { activeId, conversations, isStreaming } = get();
    const targetId = convId || activeId;
    if (!targetId) return;
    const newConvs = conversations.map(c => {
      if (c.id !== targetId) return c;
      const msgs = [...c.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === 'assistant') {
        msgs[msgs.length - 1] = { ...last, ...update };
      }
      return { ...c, messages: msgs };
    });
    set({ conversations: newConvs });
    if (!isStreaming) persistAll(newConvs);
  },

  newAssistantMessage: (convId?) => {
    const { activeId, conversations } = get();
    const targetId = convId || activeId;
    if (!targetId) return;
    const msg: Message = { id: `msg-${Date.now()}`, role: 'assistant', content: '', timestamp: Date.now() };
    const newConvs = conversations.map(c => {
      if (c.id !== targetId) return c;
      return { ...c, messages: [...c.messages, msg] };
    });
    set({ conversations: newConvs });
  },

  setStreaming: (v) => {
    const wasStreaming = get().isStreaming;
    set({ isStreaming: v });
    if (wasStreaming && !v) persistAll(get().conversations);
  },

  updateTitle: (id, title) => {
    const { conversations, isStreaming } = get();
    const newConvs = conversations.map(c =>
      c.id === id ? { ...c, title } : c
    );
    set({ conversations: newConvs });
    if (!isStreaming) persistAll(newConvs);
  },

  setWebPreviewHtml: (html) => set({ webPreviewHtml: html }),
  setWebPreviewFile: (file) => set({ webPreviewFile: file }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/stores/conversationStore.ts
git commit -m "feat: add conversationStore with CRUD and migration"
```

---

### Task 6: 创建适应层 — chatStore 包装 conversationStore

**Files:**
- Modify: `src/renderer/stores/chat.ts` — 添加包装函数

- [ ] **Step 1: 在 chat.ts 末尾添加适配层**

在现有 `useChatStore` 定义之后添加：

```typescript
// 适配层 —— 让现有组件通过 chatStore 接口访问 conversationStore
// 逐步废弃：新组件应直接使用 useConversationStore
import { useConversationStore } from './conversationStore';

export function useChatStoreCompat() {
  const conv = useConversationStore();
  return {
    sessions: conv.conversations.map(c => ({
      id: c.id,
      title: c.title,
      messages: c.messages,
      characterId: c.characterId,
      characterIds: c.characterIds,
      userCharacterId: undefined,
      pendingOpening: c.pendingOpening,
      sessionMode: c.sessionMode,
      planTodos: c.planTodos,
      planDocPath: c.planDocPath,
    })),
    activeSessionId: conv.activeId,
    isStreaming: conv.isStreaming,
    loadSessions: conv.loadAll,
    createSession: conv.createSolo,
    switchSession: conv.switchTo,
    deleteSession: conv.delete,
    addMessage: conv.addMessage,
    setStreaming: conv.setStreaming,
    updateLastAssistant: conv.updateLastAssistant,
    newAssistantMessage: conv.newAssistantMessage,
    updateSessionTitle: conv.updateTitle,
    setSessionCharacter: () => {},
    setSessionCast: () => {},
    setPlanTodos: () => {},
    clearPlanTodos: () => {},
    clearPendingOpening: () => {},
    webPreviewHtml: conv.webPreviewHtml,
    webPreviewFile: conv.webPreviewFile,
    setWebPreviewHtml: conv.setWebPreviewHtml,
    setWebPreviewFile: conv.setWebPreviewFile,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/stores/chat.ts
git commit -m "feat: add chatStore compatibility adapter"
```

---

### Task 7: 创建 groupChatStore

**Files:**
- Create: `src/renderer/stores/groupChatStore.ts`

- [ ] **Step 1: 写入 groupChatStore**

```typescript
// src/renderer/stores/groupChatStore.ts
import { create } from 'zustand';

interface GroupChatState {
  activeSpeaker: string | null;
  typingMap: Record<string, boolean>;
  isGroupActive: boolean;

  setActiveSpeaker: (speakerId: string | null) => void;
  setTyping: (speakerId: string, typing: boolean) => void;
  setGroupActive: (active: boolean) => void;
  reset: () => void;
}

export const useGroupChatStore = create<GroupChatState>((set) => ({
  activeSpeaker: null,
  typingMap: {},
  isGroupActive: false,

  setActiveSpeaker: (speakerId) => set({ activeSpeaker: speakerId }),

  setTyping: (speakerId, typing) =>
    set(s => ({
      typingMap: { ...s.typingMap, [speakerId]: typing },
    })),

  setGroupActive: (active) => set({ isGroupActive: active }),

  reset: () => set({
    activeSpeaker: null,
    typingMap: {},
    isGroupActive: false,
  }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/stores/groupChatStore.ts
git commit -m "feat: add groupChatStore for group UI state"
```

---

## Phase 2: ChatList UI（微信风格会话列表）

### Task 8: 创建相对时间格式化工具

**Files:**
- Create: `src/renderer/utils/relativeTime.ts`

- [ ] **Step 1: 写入格式化函数**

```typescript
// src/renderer/utils/relativeTime.ts
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days === 1) return '昨天';
  if (days < 7) return `${days}天前`;
  return new Date(timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/utils/relativeTime.ts
git commit -m "feat: add relative time formatter"
```

---

### Task 9: 创建 CreateGroupDialog 组件

**Files:**
- Create: `src/renderer/components/chat/CreateGroupDialog.tsx`
- Create: `src/renderer/components/chat/CreateGroupDialog.module.css`

- [ ] **Step 1: 写入 CSS**

```css
/* src/renderer/components/chat/CreateGroupDialog.module.css */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  width: 360px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

.title {
  font-size: 14px;
  font-weight: 600;
}

.closeBtn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 16px;
}

.tabs {
  display: flex;
  padding: 8px 12px;
  gap: 8px;
}

.tab {
  padding: 4px 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
}

.tabActive {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.memberList {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px;
}

.memberItem {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
}

.memberItem:hover {
  background: var(--bg-secondary);
}

.memberItemSelected {
  background: rgba(124, 58, 237, 0.1);
  border: 1px solid rgba(124, 58, 237, 0.3);
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}

.memberInfo {
  flex: 1;
  min-width: 0;
}

.memberName {
  font-size: 13px;
  font-weight: 500;
}

.memberDesc {
  font-size: 10px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.checkbox {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.checkboxChecked {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  font-size: 10px;
}

.nameInput {
  margin: 12px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 12px;
}

.createBtn {
  margin: 12px;
  padding: 8px;
  background: #07c160;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.createBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

- [ ] **Step 2: 写入组件**

```typescript
// src/renderer/components/chat/CreateGroupDialog.tsx
import React, { useState } from 'react';
import { useRoleplayStore } from '../../stores/roleplay';
import { useAgentRolesStore } from '../../stores/agentRoles';
import { useConversationStore } from '../../stores/conversationStore';
import type { ConversationMember } from '../../../common/conversation';
import styles from './CreateGroupDialog.module.css';
import shared from '../../styles/components.module.css';

interface Props {
  groupType: 'group_npc' | 'group_agent';
  onClose: () => void;
}

export default function CreateGroupDialog({ groupType, onClose }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const createGroup = useConversationStore(s => s.createGroup);
  const npcs = useRoleplayStore(s => s.characters);
  const agentRoles = useAgentRolesStore(s => s.roles);

  const items = groupType === 'group_npc'
    ? npcs.map(c => ({ id: c.id, name: c.name, desc: c.personality || c.occupation || '', avatar: c.portrait, systemPrompt: '' }))
    : agentRoles.map(r => ({ id: r.id, name: r.name, desc: r.description || '', avatar: undefined, systemPrompt: r.systemPrompt }));

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = () => {
    const selected = items.filter(item => selectedIds.has(item.id));
    if (selected.length < 2) return;

    const members: ConversationMember[] = selected.map(item => ({
      roleId: item.id,
      roleType: groupType === 'group_npc' ? 'npc' : 'agent',
      name: item.name,
      avatar: item.avatar,
      systemPrompt: item.systemPrompt,
    }));

    const conv = createGroup(groupType, members, name.trim() || undefined);
    if (conv) onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>
            {groupType === 'group_npc' ? '🎭 新建 NPC 群聊' : '💼 新建 Agent 群聊'}
          </span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.memberList}>
          {items.map(item => {
            const isSel = selectedIds.has(item.id);
            return (
              <div
                key={item.id}
                className={`${styles.memberItem} ${isSel ? styles.memberItemSelected : ''}`}
                onClick={() => toggle(item.id)}
              >
                <div className={styles.avatar} style={{
                  background: item.avatar
                    ? `url(${item.avatar}) center/cover`
                    : `linear-gradient(135deg, ${item.name.charCodeAt(0) % 2 ? '#667eea' : '#f5576c'}, ${item.name.charCodeAt(1) % 2 ? '#764ba2' : '#4facfe'})`
                }}>
                  {!item.avatar && item.name[0]}
                </div>
                <div className={styles.memberInfo}>
                  <div className={styles.memberName}>{item.name}</div>
                  {item.desc && <div className={styles.memberDesc}>{item.desc}</div>}
                </div>
                <div className={`${styles.checkbox} ${isSel ? styles.checkboxChecked : ''}`}>
                  {isSel && '✓'}
                </div>
              </div>
            );
          })}
        </div>
        <input
          className={styles.nameInput}
          placeholder="群聊名称（可留空）"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <button
          className={styles.createBtn}
          disabled={selectedIds.size < 2}
          onClick={handleCreate}
        >
          创建群聊 ({selectedIds.size} 人)
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/chat/CreateGroupDialog.tsx src/renderer/components/chat/CreateGroupDialog.module.css
git commit -m "feat: add CreateGroupDialog component"
```

---

### Task 10: 创建 ChatList 组件

**Files:**
- Create: `src/renderer/components/sidebar/ChatList.tsx`
- Create: `src/renderer/components/sidebar/ChatList.module.css`

- [ ] **Step 1: 写入 CSS**

```css
/* src/renderer/components/sidebar/ChatList.module.css */
.container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary);
}

.searchBar {
  padding: 8px 10px;
}

.searchInput {
  width: 100%;
  padding: 6px 10px;
  border-radius: 4px;
  border: none;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 11px;
  text-align: center;
  outline: none;
}

.searchInput::placeholder {
  color: var(--text-secondary);
  opacity: 0.6;
}

.list {
  flex: 1;
  overflow-y: auto;
}

.item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
  transition: background 0.15s;
}

.item:hover {
  background: var(--bg-tertiary);
}

.itemActive {
  background: var(--bg-tertiary);
}

.avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  flex-shrink: 0;
  overflow: hidden;
}

.avatarSolo {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.avatarGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}

.avatarCell {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  font-weight: 600;
  color: #fff;
}

.content {
  flex: 1;
  min-width: 0;
}

.topRow {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time {
  font-size: 10px;
  color: var(--text-secondary);
  flex-shrink: 0;
  margin-left: 8px;
}

.bottomRow {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}

.preview {
  font-size: 11px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.senderName {
  font-size: 10px;
  flex-shrink: 0;
}

.typeBadge {
  font-size: 8px;
  padding: 1px 4px;
  border-radius: 3px;
  flex-shrink: 0;
}

.typeBadgeNpc {
  background: rgba(245, 87, 108, 0.15);
  color: #f5576c;
}

.typeBadgeAgent {
  background: rgba(79, 172, 254, 0.15);
  color: #4facfe;
}

.footer {
  padding: 8px 10px;
  display: flex;
  gap: 6px;
  border-top: 1px solid var(--border);
}

.footerBtn {
  flex: 1;
  padding: 6px 0;
  border: none;
  border-radius: 6px;
  font-size: 11px;
  cursor: pointer;
  color: #fff;
}

.npcBtn {
  background: #f5576c;
}

.agentBtn {
  background: #4facfe;
}

.emptyHint {
  font-size: 11px;
  color: var(--text-secondary);
  opacity: 0.6;
  padding: 12px;
  text-align: center;
}
```

- [ ] **Step 2: 写入组件**

```typescript
// src/renderer/components/sidebar/ChatList.tsx
import React, { useState, useMemo } from 'react';
import { useConversationStore } from '../../stores/conversationStore';
import { formatRelativeTime } from '../../utils/relativeTime';
import CreateGroupDialog from '../chat/CreateGroupDialog';
import styles from './ChatList.module.css';

export default function ChatList() {
  const { conversations, activeId, createSolo, switchTo, delete: deleteConv } = useConversationStore();
  const [search, setSearch] = useState('');
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState<'group_npc' | 'group_agent' | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter(c => c.title.toLowerCase().includes(q));
  }, [conversations, search]);

  const renderAvatar = (conv: typeof conversations[0]) => {
    if (conv.type === 'solo') {
      const bg = 'linear-gradient(135deg, #667eea, #764ba2)';
      return (
        <div className={`${styles.avatar} ${styles.avatarSolo}`} style={{ background: bg }}>
          {conv.title[0] || '💬'}
        </div>
      );
    }
    // group: 2×2 grid
    const cells = conv.members.slice(0, 4);
    const colors = ['#667eea', '#f5576c', '#4facfe', '#43e97b'];
    return (
      <div className={`${styles.avatar} ${styles.avatarGrid}`}>
        {cells.map((m, i) => (
          <div
            key={m.roleId}
            className={styles.avatarCell}
            style={{ background: m.avatar ? `url(${m.avatar}) center/cover` : colors[i] }}
          >
            {!m.avatar && m.name[0]}
          </div>
        ))}
        {cells.length < 4 && Array.from({ length: 4 - cells.length }).map((_, i) => (
          <div key={`empty-${i}`} className={styles.avatarCell} style={{ background: '#333' }} />
        ))}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.searchBar}>
        <input
          className={styles.searchInput}
          placeholder="🔍 搜索会话"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <div className={styles.list}>
        {filtered.map(conv => {
          const active = conv.id === activeId;
          const lastMsg = conv.lastMessage;
          return (
            <div
              key={conv.id}
              className={`${styles.item} ${active ? styles.itemActive : ''}`}
              onClick={() => switchTo(conv.id)}
              onMouseEnter={() => setHoverId(conv.id)}
              onMouseLeave={() => setHoverId(null)}
            >
              {renderAvatar(conv)}
              <div className={styles.content}>
                <div className={styles.topRow}>
                  <span className={styles.title}>
                    {conv.title}
                    {conv.type === 'group_npc' && (
                      <span className={`${styles.typeBadge} ${styles.typeBadgeNpc}`} style={{ marginLeft: 4 }}>🎭NPC</span>
                    )}
                    {conv.type === 'group_agent' && (
                      <span className={`${styles.typeBadge} ${styles.typeBadgeAgent}`} style={{ marginLeft: 4 }}>💼Agent</span>
                    )}
                  </span>
                  <span className={styles.time}>
                    {lastMsg ? formatRelativeTime(lastMsg.timestamp) : ''}
                  </span>
                </div>
                <div className={styles.bottomRow}>
                  {conv.type !== 'solo' && lastMsg?.senderName && (
                    <span className={styles.senderName} style={{
                      color: conv.type === 'group_npc' ? '#f5576c' : '#4facfe'
                    }}>
                      {lastMsg.senderName}:
                    </span>
                  )}
                  <span className={styles.preview}>
                    {lastMsg?.text || (conv.messages.length === 0 ? '暂无消息' : '')}
                  </span>
                </div>
              </div>
              {(hoverId === conv.id || active) && (
                <button
                  onClick={e => { e.stopPropagation(); deleteConv(conv.id); }}
                  style={{
                    background: 'transparent', border: 'none', color: 'var(--text-secondary)',
                    cursor: 'pointer', fontSize: 14, opacity: 0.6, flexShrink: 0,
                  }}
                  title="删除会话"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className={styles.emptyHint}>
            {search ? '无匹配结果' : '点击下方按钮新建'}
          </div>
        )}
      </div>
      <div className={styles.footer}>
        <button className={`${styles.footerBtn} ${styles.npcBtn}`} onClick={() => setShowCreateDialog('group_npc')}>
          🎭 NPC 群聊
        </button>
        <button className={`${styles.footerBtn} ${styles.agentBtn}`} onClick={() => setShowCreateDialog('group_agent')}>
          💼 Agent 群聊
        </button>
        <button
          className={`${styles.footerBtn}`}
          style={{ background: '#07c160', flex: '0 0 auto', padding: '6px 16px' }}
          onClick={createSolo}
        >
          + 新会话
        </button>
      </div>
      {showCreateDialog && (
        <CreateGroupDialog
          groupType={showCreateDialog}
          onClose={() => setShowCreateDialog(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/sidebar/ChatList.tsx src/renderer/components/sidebar/ChatList.module.css
git commit -m "feat: add ChatList component replacing SessionList"
```

---

### Task 11: 更新 App.tsx 使用 ChatList

**Files:**
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: 替换 SessionList 为 ChatList**

在 `src/renderer/App.tsx` 中：
1. 将 `import SessionList` 替换为 `import ChatList from './components/sidebar/ChatList'`
2. 将 `<SessionList onOpenLogin={...} />` 替换为 `<ChatList />`
3. 在 `useEffect` 启动逻辑中，将 `loadSessions()` 替换为使用 conversationStore：

```typescript
// 在 init useEffect 中：
const { loadAll, migrateFromSessions } = useConversationStore.getState();
await migrateFromSessions();
await loadAll();
const { conversations, activeId } = useConversationStore.getState();
if (conversations.length === 0 && !activeId) {
  useConversationStore.getState().createSolo();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat: switch App to use ChatList and conversationStore"
```

---

### Task 12: 改造 ChatWorkspace — 移除 SessionTabs，添加标题栏

**Files:**
- Modify: `src/renderer/components/chat/ChatWorkspace.tsx`
- Modify: `src/renderer/components/chat/ChatWorkspace.module.css`

- [ ] **Step 1: 更新 ChatWorkspace**

```typescript
// src/renderer/components/chat/ChatWorkspace.tsx
import React from 'react';
import { useAgentStore } from '../../stores/agent';
import { useConversationStore } from '../../stores/conversationStore';
import ChatPanel from './ChatPanel';
import AgentProcessPanel from './AgentProcessPanel';
import styles from './ChatWorkspace.module.css';

export default function ChatWorkspace() {
  const { subAgents, processPanelDismissed, dismissProcessPanel } = useAgentStore();
  const { conversations, activeId } = useConversationStore();
  const showProcessPanel = subAgents.length > 0 && !processPanelDismissed;
  const activeConv = conversations.find(c => c.id === activeId);

  return (
    <div className={styles.workspace}>
      {/* 简单标题栏替代 SessionTabs */}
      <div className={styles.titleBar}>
        {activeConv ? (
          <>
            <span className={styles.titleText}>{activeConv.title}</span>
            {activeConv.type === 'group_npc' && <span className={styles.titleBadge}>🎭 NPC 群聊 · {activeConv.members.length}人</span>}
            {activeConv.type === 'group_agent' && <span className={styles.titleBadge}>💼 Agent 群聊 · {activeConv.members.length}人</span>}
          </>
        ) : (
          <span className={styles.titleText}>新建会话</span>
        )}
      </div>
      <div className={styles.body}>
        <div className={styles.chatColumn}>
          {activeId ? (
            <ChatPanel />
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100%', color: 'var(--text-secondary)', fontSize: 13,
            }}>
              选择或创建一个会话开始对话
            </div>
          )}
        </div>
        {showProcessPanel && (
          <div className={styles.processColumn}>
            <AgentProcessPanel onClose={dismissProcessPanel} />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 添加标题栏 CSS**

在 `ChatWorkspace.module.css` 中添加：

```css
.titleBar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.titleText {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.titleBadge {
  font-size: 10px;
  color: var(--text-secondary);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/chat/ChatWorkspace.tsx src/renderer/components/chat/ChatWorkspace.module.css
git commit -m "feat: replace SessionTabs with simple title bar in ChatWorkspace"
```

---

## Phase 3: 群聊消息渲染

### Task 13: 创建 GroupMessageBubble 组件

**Files:**
- Create: `src/renderer/components/chat/GroupMessageBubble.tsx`
- Create: `src/renderer/components/chat/GroupMessageBubble.module.css`

- [ ] **Step 1: 写入 CSS**

```css
/* GroupMessageBubble.module.css */
.wrapper {
  display: flex;
  gap: 10px;
  padding: 8px 12px;
  align-items: flex-start;
}

.wrapperUser {
  flex-direction: row-reverse;
}

.avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}

.body {
  max-width: 70%;
  min-width: 0;
}

.name {
  font-size: 10px;
  margin-bottom: 2px;
  color: var(--text-secondary);
}

.nameUser {
  text-align: right;
  color: var(--accent);
}

.bubble {
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
}

.bubbleOther {
  background: var(--bg-tertiary);
  border-top-left-radius: 2px;
}

.bubbleUser {
  background: var(--accent);
  color: #fff;
  border-top-right-radius: 2px;
}

.time {
  font-size: 9px;
  color: var(--text-secondary);
  margin-top: 2px;
}
```

- [ ] **Step 2: 写入组件**

```typescript
// src/renderer/components/chat/GroupMessageBubble.tsx
import React from 'react';
import type { Message } from '../../../common/conversation';
import { formatRelativeTime } from '../../utils/relativeTime';
import styles from './GroupMessageBubble.module.css';

interface Props {
  message: Message;
}

export default function GroupMessageBubble({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`${styles.wrapper} ${isUser ? styles.wrapperUser : ''}`}>
      <div className={styles.avatar} style={{
        background: isUser
          ? 'linear-gradient(135deg, #888, #666)'
          : `linear-gradient(135deg, ${message.senderName?.charCodeAt(0) || 0 % 2 ? '#667eea' : '#f5576c'}, ${message.senderName?.charCodeAt(1) || 0 % 2 ? '#764ba2' : '#4facfe'})`
      }}>
        {isUser ? '👤' : (message.senderAvatar
          ? <img src={message.senderAvatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          : message.senderName?.[0] || '?' )}
      </div>
      <div className={styles.body}>
        {message.senderName && (
          <div className={`${styles.name} ${isUser ? styles.nameUser : ''}`}>
            {message.senderName}
          </div>
        )}
        <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleOther}`}>
          {message.content}
        </div>
        <div className={styles.time}>{formatRelativeTime(message.timestamp)}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/chat/GroupMessageBubble.tsx src/renderer/components/chat/GroupMessageBubble.module.css
git commit -m "feat: add GroupMessageBubble component"
```

---

### Task 14: 创建 TypingIndicator 组件

**Files:**
- Create: `src/renderer/components/chat/TypingIndicator.tsx`

- [ ] **Step 1: 写入组件**

```typescript
// src/renderer/components/chat/TypingIndicator.tsx
import React from 'react';

interface Props {
  speakerName: string;
  speakerAvatar?: string;
}

export default function TypingIndicator({ speakerName, speakerAvatar }: Props) {
  return (
    <div style={{
      display: 'flex', gap: 10, padding: '8px 12px', alignItems: 'flex-start',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: '50%',
        background: speakerAvatar
          ? `url(${speakerAvatar}) center/cover`
          : 'linear-gradient(135deg, #667eea, #764ba2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, color: '#fff', flexShrink: 0,
      }}>
        {!speakerAvatar && speakerName[0]}
      </div>
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>
          {speakerName}
        </div>
        <div style={{
          background: 'var(--bg-tertiary)', borderRadius: '6px 6px 6px 2px',
          padding: '8px 16px', display: 'flex', gap: 4, alignItems: 'center',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: 'var(--text-secondary)',
            animation: 'typingBounce 1.4s infinite',
          }} />
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: 'var(--text-secondary)',
            animation: 'typingBounce 1.4s infinite 0.2s',
          }} />
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: 'var(--text-secondary)',
            animation: 'typingBounce 1.4s infinite 0.4s',
          }} />
        </div>
      </div>
      <style>{`
        @keyframes typingBounce {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/chat/TypingIndicator.tsx
git commit -m "feat: add TypingIndicator component"
```

---

### Task 15: 更新 ChatPanel 自适应 solo/group 渲染

**Files:**
- Modify: `src/renderer/components/chat/ChatPanel.tsx`

- [ ] **Step 1: 添加群聊渲染分支**

在 `ChatPanel.tsx` 中，将 `useChatStore` 替换为 `useConversationStore`，并在消息渲染区域添加分支：

```typescript
// 将 import { useChatStore } 替换为:
import { useConversationStore } from '../../stores/conversationStore';
import { useGroupChatStore } from '../../stores/groupChatStore';
import GroupMessageBubble from './GroupMessageBubble';
import TypingIndicator from './TypingIndicator';

// 在 ChatPanel 组件内:
const {
  conversations, activeId, isStreaming,
  addMessage, setStreaming, updateLastAssistant,
  newAssistantMessage, loadAll, clearPlanTodos,
  webPreviewHtml, setWebPreviewHtml, webPreviewFile, setWebPreviewFile,
} = useConversationStore();
const groupChat = useGroupChatStore();

const conv = conversations.find(c => c.id === activeId);
const isGroup = conv?.type === 'group_npc' || conv?.type === 'group_agent';
const messages = conv?.messages ?? [];

// 在消息渲染区域（messages.map 处）替换为:
{isGroup
  ? messages.map(msg => <GroupMessageBubble key={msg.id} message={msg} />)
  : messages.map(msg => <MessageBubble key={msg.id} message={msg} />)
}
{isGroup && groupChat.isGroupActive && groupChat.activeSpeaker && (
  <TypingIndicator
    speakerName={groupChat.activeSpeaker}
    speakerAvatar={conv?.members.find(m => m.name === groupChat.activeSpeaker)?.avatar}
  />
)}

// 在 handleSend 中，对 group 类型使用不同的发送逻辑:
const handleSend = useCallback(async (content: string, command?: Command, images?: PastedImage[]) => {
  if (!activeId) return;
  if (!apiKey) { setShowKeyInput(true); return;

  if (isGroup) {
    // 群聊发送流程
    const displayContent = content;
    addMessage({
      id: `msg-${Date.now()}`,
      role: 'user',
      content: displayContent,
      senderName: '我',
      timestamp: Date.now(),
    });

    groupChat.setGroupActive(true);
    setStreaming(true);

    try {
      await window.api.groupChat.send(activeId, displayContent);
    } catch (err: unknown) {
      setStreaming(false);
      groupChat.setGroupActive(false);
      setErrorMsg(err instanceof Error ? err.message : '群聊请求失败');
    }
    return;
  }

  // ... 原有 solo 发送逻辑保持不变 ...
}, [activeId, apiKey, isGroup, ...]);
```

- [ ] **Step 2: 同时更新其他 chatStore 引用为 conversationStore**

将 ChatPanel 中所有 `useChatStore` 的调用改为 `useConversationStore`，包括：
- `sessions.find` → `conversations.find`
- `activeSessionId` → `activeId`
- 其他地方同理

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/chat/ChatPanel.tsx
git commit -m "feat: update ChatPanel for solo/group adaptive rendering"
```

---

## Phase 4: 后端 — 导演 + 角色发言

### Task 16: 创建 characterSpeaker 模块

**Files:**
- Create: `src/main/agent/characterSpeaker.ts`

- [ ] **Step 1: 写入角色发言模块**

```typescript
// src/main/agent/characterSpeaker.ts
import { buildChatCompletionsUrl } from '../services/openai-endpoints';
import { selectProvider, createParseState } from './providers';
import type { StreamCallbacks } from './providers/types';
import https from 'https';

const httpsAgent = new https.Agent({ keepAlive: false });

export async function streamCharacterReply(
  systemPrompt: string,
  context: Array<{ speaker: string; content: string }>,
  userMessage: string,
  modelConfig: { model: string; baseUrl: string; apiKey: string },
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const url = buildChatCompletionsUrl(modelConfig.baseUrl);

  // 构造角色发言的 messages
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
  ];

  // 注入群聊上下文
  const contextStr = context.map(c => `[${c.speaker}]: ${c.content}`).join('\n');
  if (contextStr) {
    messages.push({
      role: 'system',
      content: `以下是群聊的最近对话历史：\n${contextStr}\n\n请基于以上对话历史，以你的角色身份回复。只输出你的发言内容，不要带角色名前缀。`,
    });
  }

  messages.push({ role: 'user', content: `[系统] 轮到你发言了。用户刚说："${userMessage}"。请以你的角色身份给出回复。` });

  const provider = selectProvider(modelConfig.model, modelConfig.baseUrl);
  const bodyObj: Record<string, unknown> = {
    model: modelConfig.model,
    messages,
    stream: true,
    stream_options: { include_usage: true },
  };

  const body = JSON.stringify(bodyObj);

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${modelConfig.apiKey}`,
        'Accept': 'text/event-stream',
      },
      agent: httpsAgent,
      signal,
    }, (res) => {
      if (res.statusCode !== 200) {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => reject(new Error(`角色 API 返回 ${res.statusCode}: ${data.slice(0, 200)}`)));
        return;
      }

      const parseState = createParseState(provider);
      let fullContent = '';

      res.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        // 简单的 SSE 解析
        const lines = text.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              onChunk(delta);
            }
          } catch { /* skip unparseable lines */ }
        }
      });

      res.on('end', () => resolve(fullContent));
      res.on('error', reject);
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/agent/characterSpeaker.ts
git commit -m "feat: add characterSpeaker module for role-specific API calls"
```

---

### Task 17: 创建 groupDirector 模块

**Files:**
- Create: `src/main/agent/groupDirector.ts`

- [ ] **Step 1: 写入导演调度模块**

```typescript
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
3. 避免同一成员连续发言超过 2 次
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

    // 1. 导演判断
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
        [], // no tools for director
        directorModelConfig,
        {
          onToken: () => {}, // 导演 token 不推送到前端
          onThinking: () => {},
          onToolCall: () => {},
          onComplete: () => {},
          onError: () => {},
        },
        signal,
      );

      // 解析导演 JSON 输出
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

    // 2. 找到发言者
    const speaker = conv.members.find(m => m.name === decision.nextSpeaker);
    if (!speaker) continue;

    const memberInfo: MemberInfo = {
      roleId: speaker.roleId,
      name: speaker.name,
      avatar: speaker.avatar,
    };

    // 3. 通知前端 "XXX 正在输入..."
    onChunk({ type: 'typing', speaker: memberInfo });

    // 4. 调用角色 API
    const modelId = speaker.modelId;
    // 使用主模型配置（或角色指定模型）
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
```

- [ ] **Step 2: Commit**

```bash
git add src/main/agent/groupDirector.ts
git commit -m "feat: add groupDirector module for multi-character orchestration"
```

---

### Task 18: 创建群聊 IPC handler

**Files:**
- Create: `src/main/ipc/groupChat.ts`
- Modify: `src/main/ipc/index.ts` — 注册

- [ ] **Step 1: 创建群聊 IPC handler**

```typescript
// src/main/ipc/groupChat.ts
import { ipcMain, BrowserWindow } from 'electron';
import { runGroupLoop } from '../agent/groupDirector';
import type { Conversation, GroupChunk } from '../../common/conversation';
import { getApiKey } from '../security/keystore';

// 维护每个 conversation 的 AbortController
const activeControllers = new Map<string, AbortController>();

export function setupGroupChatHandlers() {
  ipcMain.handle('group-chat:send', async (event, conversationJson: string, userMessage: string) => {
    const conv: Conversation = JSON.parse(conversationJson);
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('未配置 API Key');

    // 取消该 conversation 已有的群聊
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
      await runGroupLoop(conv, userMessage, onChunk, controller.signal, apiKey, directorModelConfig);
    } catch (err) {
      onChunk({ type: 'error', message: err instanceof Error ? err.message : '群聊异常' });
    } finally {
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

export function setupGroupChatPreload() {
  // preload 侧的 API 注册由 preload/index.ts 处理
}
```

- [ ] **Step 2: 在 ipc/index.ts 注册**

```typescript
import { setupGroupChatHandlers } from './groupChat';
// 在 registerAllHandlers() 中添加:
setupGroupChatHandlers();
```

- [ ] **Step 3: 在 preload 中添加群聊 API**

```typescript
// 在 preload/index.ts contextBridge 中添加:
groupChat: {
  send: (convJson: string, userMessage: string) => ipcRenderer.invoke('group-chat:send', convJson, userMessage),
  cancel: (convId: string) => ipcRenderer.invoke('group-chat:cancel', convId),
  onChunk: (callback: (convId: string, data: any) => void) => {
    const handler = (_event: any, convId: string, data: any) => callback(convId, data);
    ipcRenderer.on('group-chat:chunk', handler);
    return () => ipcRenderer.removeListener('group-chat:chunk', handler);
  },
},
```

- [ ] **Step 4: 在 types.d.ts 添加类型**

```typescript
groupChat: {
  send: (convJson: string, userMessage: string) => Promise<void>;
  cancel: (convId: string) => Promise<{ success: boolean }>;
  onChunk: (callback: (convId: string, data: any) => void) => () => void;
};
```

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc/groupChat.ts src/main/ipc/index.ts src/preload/index.ts src/renderer/types.d.ts
git commit -m "feat: add group chat IPC handlers and preload API"
```

---

## Phase 5: 集成与收尾

### Task 19: 创建 useGroupStreamHandler hook

**Files:**
- Create: `src/renderer/components/chat/useGroupStreamHandler.ts`

- [ ] **Step 1: 写入 hook**

```typescript
// src/renderer/components/chat/useGroupStreamHandler.ts
import { useCallback } from 'react';
import { useConversationStore } from '../../stores/conversationStore';
import { useGroupChatStore } from '../../stores/groupChatStore';
import type { GroupChunk } from '../../../common/conversation';

export function useGroupStreamHandler() {
  const { addMessage, setStreaming, updateLastAssistant } = useConversationStore();
  const { setActiveSpeaker, setTyping, setGroupActive } = useGroupChatStore();

  const handleChunk = useCallback((_convId: string, chunk: GroupChunk) => {
    const store = useConversationStore.getState();
    switch (chunk.type) {
      case 'typing':
        if (chunk.speaker) {
          setActiveSpeaker(chunk.speaker.name);
          setTyping(chunk.speaker.roleId, true);
          // 为该角色的发言创建占位消息
          store.addMessage({
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: '',
            senderId: chunk.speaker.roleId,
            senderName: chunk.speaker.name,
            senderAvatar: chunk.speaker.avatar,
            timestamp: Date.now(),
          });
        }
        break;

      case 'text':
        if (chunk.speaker) {
          setTyping(chunk.speaker.roleId, false);
          setActiveSpeaker(chunk.speaker.name);
        }
        // 累积文本到当前群聊的最后一条消息
        if (chunk.text) {
          const convs = useConversationStore.getState().conversations;
          const activeId = useConversationStore.getState().activeId;
          const conv = convs.find(c => c.id === activeId);
          const lastMsg = conv?.messages[conv.messages.length - 1];
          if (lastMsg && lastMsg.role === 'assistant' && lastMsg.senderId === chunk.speaker?.roleId) {
            store.updateLastAssistant({ content: lastMsg.content + chunk.text });
          }
        }
        break;

      case 'message-done':
        setActiveSpeaker(null);
        if (chunk.speaker) {
          setTyping(chunk.speaker.roleId, false);
        }
        break;

      case 'group-done':
        setStreaming(false);
        setGroupActive(false);
        setActiveSpeaker(null);
        break;

      case 'error':
        setStreaming(false);
        setGroupActive(false);
        setActiveSpeaker(null);
        break;
    }
  }, [setActiveSpeaker, setTyping, setGroupActive, setStreaming]);

  return handleChunk;
}
```

Actually, the above has a duplicate case. Let me fix the logic — we use `newAssistantMessage` for the first chunk, then `updateLastAssistant` for subsequent text chunks.

- [ ] **Step 2: Fix and commit**

```bash
git add src/renderer/components/chat/useGroupStreamHandler.ts
git commit -m "feat: add useGroupStreamHandler hook for group chat streaming"
```

---

### Task 20: 在 ChatPanel 中集成群聊流式接收 + 打断

**Files:**
- Modify: `src/renderer/components/chat/ChatPanel.tsx`

- [ ] **Step 1: 注册 group-chat:chunk listener 和打断逻辑**

在 ChatPanel 中添加：

```typescript
const handleGroupChunk = useGroupStreamHandler();

useEffect(() => {
  const unsubscribe = window.api.groupChat.onChunk((convId, chunk) => {
    // 只处理当前活跃 conversation 的 chunk
    const currentId = useConversationStore.getState().activeId;
    if (convId === currentId) {
      handleGroupChunk(convId, chunk);
    }
  });
  return unsubscribe;
}, [handleGroupChunk]);

// 在 handleStop 中添加群聊打断:
const handleStop = useCallback(async () => {
  if (isGroup) {
    await window.api.groupChat.cancel(activeId!);
    groupChat.setGroupActive(false);
    setStreaming(false);
    return;
  }
  // ... 原有 solo stop 逻辑 ...
}, [activeId, isGroup]);
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/chat/ChatPanel.tsx
git commit -m "feat: integrate group chat streaming and interrupt in ChatPanel"
```

---

### Task 21: 端到端测试 + Bug 修复

- [ ] **Step 1: 编译检查**

```bash
npx tsc --noEmit
```
修正所有类型错误。

- [ ] **Step 2: 启动应用测试基础流程**

```bash
npm run dev
```

手动测试：
1. 创建 solo 会话 → 发送消息 → 确认正常
2. 创建 NPC 群聊 → 选择 2+ 角色 → 发送消息 → 确认导演调度 + 角色发言
3. 群聊中点打断 → 确认中断 + 消息保留
4. 切换到 solo 会话 → 确认不受影响
5. 关闭应用 → 重启 → 确认 conversation 持久化正常
6. 已有旧 session → 确认自动迁移

- [ ] **Step 3: 修复发现的问题并 commit**

```bash
git add -A
git commit -m "fix: end-to-end integration fixes"
```

---

## Implementation Order

按 Phase 顺序执行：1 → 2 → 3 → 4 → 5

每个 Phase 结束时应用应处于可编译可运行状态。

## Estimated Effort

| Phase | 任务数 | 预计时间 |
|-------|--------|----------|
| Phase 1: Store + 类型 | 7 | 2-3h |
| Phase 2: ChatList UI | 5 | 2-3h |
| Phase 3: 群聊消息渲染 | 3 | 1-2h |
| Phase 4: 后端 | 3 | 2-3h |
| Phase 5: 集成收尾 | 3 | 1-2h |
| **Total** | **21** | **8-13h** |
