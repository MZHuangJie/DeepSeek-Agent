# DeepSeek Agent 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个基于 Electron 的 DeepSeek Agent 桌面应用，具备 IDE 级代码编辑、Agent 可观测面板和集成终端。

**Architecture:** Electron 主进程负责 DeepSeek API 通信、文件系统操作、终端进程管理和 SQLite 持久化。Preload 通过 contextBridge 暴露类型安全的 IPC。React 渲染进程通过 zustand 管理状态，Monaco Editor 和 xterm.js 提供代码编辑和终端能力。

**Tech Stack:** Electron + React + TypeScript + Vite + Monaco Editor + xterm.js + better-sqlite3 + zustand

---

## 文件结构

```
deepseek-agent/
├── package.json
├── tsconfig.json
├── vite.main.config.ts
├── vite.preload.config.ts
├── vite.renderer.config.ts
├── forge.config.ts
├── src/
│   ├── main/
│   │   ├── index.ts                 # App 入口，窗口创建
│   │   ├── ipc/
│   │   │   ├── index.ts             # IPC handler 注册
│   │   │   ├── files.ts             # 文件操作 handler
│   │   │   ├── agent.ts             # Agent 调用 handler
│   │   │   ├── terminal.ts          # 终端 spawn handler
│   │   │   └── settings.ts          # 设置管理 handler
│   │   ├── agent/
│   │   │   ├── client.ts            # DeepSeek API streaming client
│   │   │   ├── tools.ts             # 工具注册表与执行
│   │   │   ├── context.ts           # 项目上下文构建
│   │   │   └── cache.ts             # KV Cache 前缀管理
│   │   ├── db/
│   │   │   ├── connection.ts        # better-sqlite3 连接
│   │   │   ├── sessions.ts          # 会话 CRUD
│   │   │   └── settings.ts          # 设置存取
│   │   └── security/
│   │       └── keystore.ts          # API Key 安全加密
│   ├── preload/
│   │   └── index.ts                 # contextBridge API 暴露
│   └── renderer/
│       ├── index.html
│       ├── index.tsx
│       ├── App.tsx
│       ├── stores/
│       │   ├── layout.ts            # 面板尺寸/可见性
│       │   ├── chat.ts              # 消息与流式响应
│       │   ├── agent.ts             # Agent 状态（步骤、工具、token）
│       │   ├── files.ts             # 文件树、打开标签
│       │   └── terminal.ts          # 终端实例
│       ├── components/
│       │   ├── layout/
│       │   │   ├── AppShell.tsx      # 四区域布局容器
│       │   │   └── ResizeHandle.tsx  # 拖拽调整面板大小
│       │   ├── sidebar/
│       │   │   ├── Sidebar.tsx       # 侧边栏容器 + Tab 切换
│       │   │   ├── FileTree.tsx      # 文件树
│       │   │   └── SessionList.tsx   # 会话列表
│       │   ├── editor/
│       │   │   ├── EditorTabs.tsx    # 文件标签页栏
│       │   │   ├── CodeEditor.tsx    # Monaco 编辑器封装
│       │   │   └── DiffView.tsx      # Diff 对比视图
│       │   ├── chat/
│       │   │   ├── ChatPanel.tsx     # 聊天面板容器
│       │   │   ├── MessageBubble.tsx # 消息气泡
│       │   │   ├── ThinkingChain.tsx # 思考链展开卡片
│       │   │   └── ChatInput.tsx     # 输入框 + @文件引用
│       │   ├── agent/
│       │   │   ├── AgentPanel.tsx    # Agent 可观测面板
│       │   │   ├── CurrentStep.tsx   # 当前步骤 + 进度条
│       │   │   ├── ToolTimeline.tsx  # 工具调用时间线
│       │   │   └── TokenUsage.tsx    # Token 消耗统计
│       │   └── terminal/
│       │       ├── TerminalPanel.tsx # 终端面板容器
│       │       └── TerminalTabs.tsx  # 终端标签切换
│       └── styles/
│           └── theme.css            # 深色主题样式
```

---

## 阶段一：项目脚手架

### Task 1: 初始化 Electron + React + Vite 项目

**Files:**
- Create: `package.json`, `tsconfig.json`, `forge.config.ts`
- Create: `vite.main.config.ts`, `vite.preload.config.ts`, `vite.renderer.config.ts`

- [ ] **Step 1: 使用 electron-forge 脚手架创建项目**

```bash
npm init electron-app@latest deepseek-agent -- --template=vite-typescript
cd deepseek-agent
```

- [ ] **Step 2: 安装前端依赖**

```bash
npm install react react-dom zustand better-sqlite3
npm install -D @types/react @types/react-dom @types/better-sqlite3
```

- [ ] **Step 3: 验证项目能启动**

```bash
npm start
```

Expected: Electron 窗口打开，显示默认 Hello World 页面。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Electron + React + Vite project"
```

---

## 阶段二：应用骨架 + 布局

### Task 2: 主进程窗口创建与基础 IPC

**Files:**
- Create: `src/main/index.ts`
- Create: `src/main/ipc/index.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: 编写主进程窗口创建代码**

`src/main/index.ts`:
```typescript
import { app, BrowserWindow } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1e1e2e',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
```

- [ ] **Step 2: 编写 preload 脚本骨架**

`src/preload/index.ts`:
```typescript
import { contextBridge, ipcRenderer } from 'electron';

const api = {
  files: {
    list: (dirPath: string) => ipcRenderer.invoke('files:list', dirPath),
    read: (filePath: string) => ipcRenderer.invoke('files:read', filePath),
  },
  agent: {
    send: (messages: unknown) => ipcRenderer.invoke('agent:send', messages),
    cancel: () => ipcRenderer.invoke('agent:cancel'),
    onStreamChunk: (cb: (chunk: unknown) => void) => {
      const handler = (_: unknown, chunk: unknown) => cb(chunk);
      ipcRenderer.on('agent:stream-chunk', handler);
      return () => ipcRenderer.removeListener('agent:stream-chunk', handler);
    },
  },
  terminal: {
    create: () => ipcRenderer.invoke('terminal:create'),
    write: (id: string, data: string) => ipcRenderer.invoke('terminal:write', id, data),
    onData: (id: string, cb: (data: string) => void) => {
      const handler = (_: unknown, data: { id: string; output: string }) => {
        if (data.id === id) cb(data.output);
      };
      ipcRenderer.on('terminal:data', handler);
      return () => ipcRenderer.removeListener('terminal:data', handler);
    },
  },
};

contextBridge.exposeInMainWorld('api', api);

export type API = typeof api;
```

- [ ] **Step 3: 编写 IPC handler 注册代码**

`src/main/ipc/index.ts`:
```typescript
import { ipcMain } from 'electron';
import { setupFileHandlers } from './files';
import { setupAgentHandlers } from './agent';
import { setupTerminalHandlers } from './terminal';
import { setupSettingsHandlers } from './settings';

export function registerAllHandlers() {
  setupFileHandlers();
  setupAgentHandlers();
  setupTerminalHandlers();
  setupSettingsHandlers();
}
```

在 `src/main/index.ts` 的 `createWindow` 之前调用 `registerAllHandlers()`。

- [ ] **Step 4: 创建占位 handler 文件**

`src/main/ipc/files.ts`:
```typescript
import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';

export function setupFileHandlers() {
  ipcMain.handle('files:list', async (_event, dirPath: string) => {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.map(e => ({
      name: e.name,
      isDirectory: e.isDirectory(),
      path: path.join(dirPath, e.name),
    }));
  });

  ipcMain.handle('files:read', async (_event, filePath: string) => {
    return fs.readFileSync(filePath, 'utf-8');
  });
}
```

`src/main/ipc/agent.ts`, `src/main/ipc/terminal.ts`, `src/main/ipc/settings.ts` 创建为空的 handler 注册函数。

- [ ] **Step 5: 更新 vite 配置注入 dev server URL 变量**

`vite.main.config.ts`:
```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['better-sqlite3', 'electron'],
    },
  },
  define: {
    MAIN_WINDOW_VITE_DEV_SERVER_URL: JSON.stringify(process.env.VITE_DEV_SERVER_URL || ''),
  },
});
```

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat: add main process window creation and IPC skeleton"
```

### Task 3: 布局外壳 — AppShell + ResizeHandle

**Files:**
- Create: `src/renderer/index.html`
- Create: `src/renderer/index.tsx`
- Create: `src/renderer/App.tsx`
- Create: `src/renderer/styles/theme.css`
- Create: `src/renderer/components/layout/AppShell.tsx`
- Create: `src/renderer/components/layout/ResizeHandle.tsx`
- Create: `src/renderer/stores/layout.ts`

- [ ] **Step 1: 创建 HTML 入口**

`src/renderer/index.html`:
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DeepSeek Agent</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./index.tsx"></script>
</body>
</html>
```

- [ ] **Step 2: 创建 React 入口**

`src/renderer/index.tsx`:
```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/theme.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);
```

- [ ] **Step 3: 创建主题 CSS**

`src/renderer/styles/theme.css`:
```css
:root {
  --bg-primary: #1e1e2e;
  --bg-secondary: #252536;
  --bg-tertiary: #2d2d44;
  --accent: #7c3aed;
  --accent-hover: #6d28d9;
  --text-primary: #e0e0e0;
  --text-secondary: #8888a0;
  --border: #3a3a50;
  --terminal-bg: #0d0d0d;
  --chat-user: rgba(124, 58, 237, 0.1);
  --chat-ai: #2d2d44;
  --success: #22c55e;
  --warning: #f59e0b;
  --error: #ef4444;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

html, body, #root {
  height: 100%;
  overflow: hidden;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
}

::-webkit-scrollbar {
  width: 6px; height: 6px;
}
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
```

- [ ] **Step 4: 创建布局 store**

`src/renderer/stores/layout.ts`:
```typescript
import { create } from 'zustand';

interface LayoutState {
  sidebarWidth: number;
  agentPanelWidth: number;
  terminalHeight: number;
  sidebarTab: 'files' | 'sessions';
  setSidebarWidth: (w: number) => void;
  setAgentPanelWidth: (w: number) => void;
  setTerminalHeight: (h: number) => void;
  setSidebarTab: (t: 'files' | 'sessions') => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  sidebarWidth: 240,
  agentPanelWidth: 280,
  terminalHeight: 150,
  sidebarTab: 'files',
  setSidebarWidth: (w) => set({ sidebarWidth: w }),
  setAgentPanelWidth: (w) => set({ agentPanelWidth: w }),
  setTerminalHeight: (h) => set({ terminalHeight: h }),
  setSidebarTab: (t) => set({ sidebarTab: t }),
}));
```

- [ ] **Step 5: 创建 ResizeHandle 组件**

`src/renderer/components/layout/ResizeHandle.tsx`:
```tsx
import React, { useCallback, useRef } from 'react';

interface Props {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
}

export default function ResizeHandle({ direction, onResize }: Props) {
  const startRef = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startRef.current = direction === 'horizontal' ? e.clientX : e.clientY;
    const onMouseMove = (ev: MouseEvent) => {
      const current = direction === 'horizontal' ? ev.clientX : ev.clientY;
      onResize(startRef.current - current);
      startRef.current = current;
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [direction, onResize]);

  const style: React.CSSProperties = direction === 'horizontal'
    ? { width: 4, cursor: 'col-resize', height: '100%', background: 'var(--border)' }
    : { height: 4, cursor: 'row-resize', width: '100%', background: 'var(--border)' };

  return <div style={style} onMouseDown={onMouseDown} />;
}
```

- [ ] **Step 6: 创建 AppShell 组件**

`src/renderer/components/layout/AppShell.tsx`:
```tsx
import React from 'react';
import { useLayoutStore } from '../../stores/layout';
import ResizeHandle from './ResizeHandle';

export default function AppShell() {
  const {
    sidebarWidth, agentPanelWidth, terminalHeight,
    setSidebarWidth, setAgentPanelWidth, setTerminalHeight,
  } = useLayoutStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{ width: sidebarWidth, flexShrink: 0, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}>
          {/* Sidebar content placeholder */}
        </div>
        <ResizeHandle direction="horizontal" onResize={(d) => setSidebarWidth(Math.max(180, sidebarWidth - d))} />
        {/* Main Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1 }}>
            {/* Editor + Chat placeholder */}
          </div>
        </div>
        <ResizeHandle direction="horizontal" onResize={(d) => setAgentPanelWidth(Math.max(200, agentPanelWidth + d))} />
        {/* Agent Panel */}
        <div style={{ width: agentPanelWidth, flexShrink: 0, background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)' }}>
          {/* Agent panel placeholder */}
        </div>
      </div>
      <ResizeHandle direction="vertical" onResize={(d) => setTerminalHeight(Math.max(80, terminalHeight + d))} />
      {/* Terminal */}
      <div style={{ height: terminalHeight, flexShrink: 0, background: 'var(--terminal-bg)', borderTop: '1px solid var(--border)' }}>
        {/* Terminal placeholder */}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: 创建 App.tsx**

`src/renderer/App.tsx`:
```tsx
import React from 'react';
import AppShell from './components/layout/AppShell';

export default function App() {
  return <AppShell />;
}
```

- [ ] **Step 8: 提交**

```bash
git add -A
git commit -m "feat: add 4-zone layout shell with resizable panels"
```

---

## 阶段三：侧边栏

### Task 4: 侧边栏 — 文件树 + 会话列表

**Files:**
- Create: `src/renderer/components/sidebar/Sidebar.tsx`
- Create: `src/renderer/components/sidebar/FileTree.tsx`
- Create: `src/renderer/components/sidebar/SessionList.tsx`
- Create: `src/renderer/stores/files.ts`

- [ ] **Step 1: 创建文件 store**

`src/renderer/stores/files.ts`:
```typescript
import { create } from 'zustand';

export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

interface OpenTab {
  path: string;
  name: string;
}

interface FilesState {
  tree: FileNode[];
  openTabs: OpenTab[];
  activeTab: string | null;
  setTree: (tree: FileNode[]) => void;
  openFile: (path: string, name: string) => void;
  closeTab: (path: string) => void;
  setActiveTab: (path: string) => void;
}

export const useFilesStore = create<FilesState>((set, get) => ({
  tree: [],
  openTabs: [],
  activeTab: null,
  setTree: (tree) => set({ tree }),
  openFile: (path, name) => {
    const { openTabs } = get();
    if (!openTabs.find(t => t.path === path)) {
      set({ openTabs: [...openTabs, { path, name }] });
    }
    set({ activeTab: path });
  },
  closeTab: (path) => {
    const { openTabs, activeTab } = get();
    const idx = openTabs.findIndex(t => t.path === path);
    const newTabs = openTabs.filter(t => t.path !== path);
    const newActive = activeTab === path
      ? newTabs[Math.min(idx, newTabs.length - 1)]?.path ?? null
      : activeTab;
    set({ openTabs: newTabs, activeTab: newActive });
  },
  setActiveTab: (path) => set({ activeTab: path }),
}));
```

- [ ] **Step 2: 创建 FileTree 组件**

`src/renderer/components/sidebar/FileTree.tsx`:
```tsx
import React, { useCallback } from 'react';
import { useFilesStore, FileNode } from '../../stores/files';

function TreeNode({ node, depth = 0 }: { node: FileNode; depth?: number }) {
  const { openFile } = useFilesStore();
  const [expanded, setExpanded] = React.useState(false);

  const handleClick = useCallback(() => {
    if (node.isDirectory) {
      setExpanded(!expanded);
    } else {
      openFile(node.path, node.name);
    }
  }, [node, expanded, openFile]);

  return (
    <div>
      <div
        onClick={handleClick}
        style={{ paddingLeft: 12 + depth * 16, padding: '4px 8px 4px ' + (12 + depth * 16) + 'px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <span style={{ fontSize: 12 }}>{node.isDirectory ? (expanded ? '▾' : '▸') : '▹'}</span>
        <span>{node.isDirectory ? '📁' : '📄'}</span>
        <span style={{ fontSize: 13 }}>{node.name}</span>
      </div>
      {expanded && node.children?.map(child => (
        <TreeNode key={child.path} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function FileTree() {
  const { tree } = useFilesStore();

  return (
    <div style={{ overflow: 'auto', height: '100%' }}>
      {tree.map(node => <TreeNode key={node.path} node={node} />)}
    </div>
  );
}
```

- [ ] **Step 3: 创建 SessionList 组件**

`src/renderer/components/sidebar/SessionList.tsx`:
```tsx
import React from 'react';
import { useChatStore } from '../../stores/chat';

export default function SessionList() {
  const { sessions, activeSessionId, createSession, switchSession } = useChatStore();

  return (
    <div style={{ padding: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Chat Sessions</span>
        <button onClick={createSession} style={{ background: 'var(--accent)', border: 'none', color: '#fff', width: 22, height: 22, borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>+</button>
      </div>
      {sessions.map(s => (
        <div
          key={s.id}
          onClick={() => switchSession(s.id)}
          style={{ padding: '6px 8px', borderRadius: 4, cursor: 'pointer', marginBottom: 2, background: s.id === activeSessionId ? 'var(--bg-tertiary)' : 'transparent', fontSize: 12 }}
        >
          💬 {s.title}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: 创建 Sidebar 容器**

`src/renderer/components/sidebar/Sidebar.tsx`:
```tsx
import React from 'react';
import { useLayoutStore } from '../../stores/layout';
import FileTree from './FileTree';
import SessionList from './SessionList';

export default function Sidebar() {
  const { sidebarTab, setSidebarTab } = useLayoutStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => setSidebarTab('files')}
          style={{ flex: 1, padding: '8px', textAlign: 'center', fontSize: 12, fontWeight: sidebarTab === 'files' ? 600 : 400, border: 'none', background: 'transparent', color: sidebarTab === 'files' ? 'var(--accent)' : 'var(--text-secondary)', borderBottom: sidebarTab === 'files' ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer' }}>
          📁 文件
        </button>
        <button onClick={() => setSidebarTab('sessions')}
          style={{ flex: 1, padding: '8px', textAlign: 'center', fontSize: 12, fontWeight: sidebarTab === 'sessions' ? 600 : 400, border: 'none', background: 'transparent', color: sidebarTab === 'sessions' ? 'var(--accent)' : 'var(--text-secondary)', borderBottom: sidebarTab === 'sessions' ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer' }}>
          💬 会话
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {sidebarTab === 'files' ? <FileTree /> : <SessionList />}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: add sidebar with file tree and session list"
```

---

## 阶段四：代码编辑器

### Task 5: Monaco Editor 集成

**Files:**
- Create: `src/renderer/components/editor/EditorTabs.tsx`
- Create: `src/renderer/components/editor/CodeEditor.tsx`
- Create: `src/renderer/components/editor/DiffView.tsx`

- [ ] **Step 1: 安装 Monaco Editor**

```bash
npm install monaco-editor @monaco-editor/react
```

- [ ] **Step 2: 创建 CodeEditor 组件**

`src/renderer/components/editor/CodeEditor.tsx`:
```tsx
import React from 'react';
import Editor, { loader } from '@monaco-editor/react';

loader.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });

interface Props {
  content: string;
  language: string;
  onChange?: (value: string | undefined) => void;
  readOnly?: boolean;
}

export default function CodeEditor({ content, language, onChange, readOnly = false }: Props) {
  return (
    <Editor
      value={content}
      language={language}
      onChange={onChange}
      theme="vs-dark"
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        padding: { top: 8 },
        automaticLayout: true,
      }}
      height="100%"
    />
  );
}
```

- [ ] **Step 3: 创建 EditorTabs 组件**

`src/renderer/components/editor/EditorTabs.tsx`:
```tsx
import React from 'react';
import { useFilesStore } from '../../stores/files';

export default function EditorTabs() {
  const { openTabs, activeTab, closeTab, setActiveTab } = useFilesStore();

  return (
    <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', overflow: 'auto' }}>
      {openTabs.map(tab => (
        <div key={tab.path}
          onClick={() => setActiveTab(tab.path)}
          style={{
            padding: '4px 12px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
            borderBottom: activeTab === tab.path ? '2px solid var(--accent)' : '2px solid transparent',
            color: activeTab === tab.path ? 'var(--accent)' : 'var(--text-secondary)',
            whiteSpace: 'nowrap',
          }}
        >
          <span>📄</span>
          <span>{tab.name}</span>
          <span onClick={(e) => { e.stopPropagation(); closeTab(tab.path); }} style={{ marginLeft: 4, fontSize: 14, opacity: 0.6 }}>×</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: 创建 DiffView 组件**

`src/renderer/components/editor/DiffView.tsx`:
```tsx
import React from 'react';
import { DiffEditor, loader } from '@monaco-editor/react';

loader.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });

interface Props {
  original: string;
  modified: string;
  language: string;
}

export default function DiffView({ original, modified, language }: Props) {
  return (
    <DiffEditor
      original={original}
      modified={modified}
      language={language}
      theme="vs-dark"
      options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, automaticLayout: true }}
      height="100%"
    />
  );
}
```

- [ ] **Step 5: 更新 AppShell 集成编辑器**

在 `AppShell.tsx` 的主区域中加入 EditorTabs 和 CodeEditor。

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat: integrate Monaco editor with tabs and diff view"
```

---

## 阶段五：终端

### Task 6: xterm.js 集成终端

**Files:**
- Create: `src/renderer/components/terminal/TerminalPanel.tsx`
- Create: `src/renderer/components/terminal/TerminalTabs.tsx`
- Create: `src/renderer/stores/terminal.ts`
- Modify: `src/main/ipc/terminal.ts`

- [ ] **Step 1: 安装 xterm.js**

```bash
npm install xterm @xterm/addon-fit @xterm/addon-web-links
```

- [ ] **Step 2: 实现主进程终端 handler**

`src/main/ipc/terminal.ts`:
```typescript
import { ipcMain } from 'electron';
import { spawn, IPty } from 'node-pty';

const terminals = new Map<string, IPty>();

export function setupTerminalHandlers() {
  ipcMain.handle('terminal:create', async () => {
    const id = `term-${Date.now()}`;
    const pty = spawn(
      process.platform === 'win32' ? 'powershell.exe' : 'bash',
      [],
      { name: 'xterm-color', cols: 80, rows: 24, cwd: process.cwd() }
    );
    terminals.set(id, pty);
    pty.onData((data: string) => {
      // Send to renderer via IPC
      const win = require('electron').BrowserWindow.getAllWindows()[0];
      win?.webContents.send('terminal:data', { id, output: data });
    });
    return id;
  });

  ipcMain.handle('terminal:write', async (_event, id: string, data: string) => {
    terminals.get(id)?.write(data);
  });

  ipcMain.handle('terminal:resize', async (_event, id: string, cols: number, rows: number) => {
    terminals.get(id)?.resize(cols, rows);
  });

  ipcMain.handle('terminal:destroy', async (_event, id: string) => {
    terminals.get(id)?.kill();
    terminals.delete(id);
  });
}
```

- [ ] **Step 3: 安装 node-pty**

```bash
npm install node-pty
```

- [ ] **Step 4: 创建终端 store**

`src/renderer/stores/terminal.ts`:
```typescript
import { create } from 'zustand';

interface TermInstance {
  id: string;
  name: string;
}

interface TerminalState {
  terminals: TermInstance[];
  activeTermId: string | null;
  createTerminal: () => Promise<void>;
  closeTerminal: (id: string) => void;
  setActiveTerm: (id: string) => void;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  terminals: [],
  activeTermId: null,
  createTerminal: async () => {
    const id = await window.api.terminal.create();
    set(s => ({
      terminals: [...s.terminals, { id, name: `Terminal ${s.terminals.length + 1}` }],
      activeTermId: id,
    }));
  },
  closeTerminal: (id) => {
    window.api.terminal.destroy?.(id);
    const { terminals, activeTermId } = get();
    const newTerms = terminals.filter(t => t.id !== id);
    set({
      terminals: newTerms,
      activeTermId: activeTermId === id ? (newTerms[0]?.id ?? null) : activeTermId,
    });
  },
  setActiveTerm: (id) => set({ activeTermId: id }),
}));
```

- [ ] **Step 5: 创建 TerminalPanel 组件**

`src/renderer/components/terminal/TerminalPanel.tsx`:
```tsx
import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import 'xterm/css/xterm.css';

interface Props {
  termId: string;
}

export default function TerminalInstance({ termId }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const term = new Terminal({
      theme: { background: '#0d0d0d', foreground: '#00ff00', cursor: '#00ff00' },
      fontSize: 13,
      fontFamily: 'Consolas, "Courier New", monospace',
      cursorBlink: true,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(ref.current);
    fitAddon.fit();

    const unsub = window.api.terminal.onData(termId, (data: string) => term.write(data));
    term.onData((data: string) => window.api.terminal.write(termId, data));

    termRef.current = term;
    return () => { unsub(); term.dispose(); };
  }, [termId]);

  useEffect(() => {
    const handler = () => termRef.current && (termRef.current as any)._core._renderService?.refresh();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return <div ref={ref} style={{ height: '100%' }} />;
}
```

- [ ] **Step 6: 创建 TerminalTabs 组件**

`src/renderer/components/terminal/TerminalTabs.tsx`:
```tsx
import React from 'react';
import { useTerminalStore } from '../../stores/terminal';

export default function TerminalTabs() {
  const { terminals, activeTermId, createTerminal, closeTerminal, setActiveTerm } = useTerminalStore();

  return (
    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, padding: '4px 8px', color: 'var(--text-secondary)' }}>PROBLEMS</div>
      <div style={{ fontSize: 11, padding: '4px 8px', color: 'var(--text-secondary)' }}>OUTPUT</div>
      <div style={{ fontSize: 11, padding: '4px 8px', color: 'var(--text-secondary)' }}>DEBUG CONSOLE</div>
      {terminals.map(t => (
        <div key={t.id}
          onClick={() => setActiveTerm(t.id)}
          style={{
            padding: '4px 12px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
            background: t.id === activeTermId ? 'var(--terminal-bg)' : 'transparent',
            color: t.id === activeTermId ? '#fff' : 'var(--text-secondary)',
            borderTop: t.id === activeTermId ? '1px solid var(--accent)' : '1px solid transparent',
          }}>
          <span>{t.name}</span>
          <span onClick={(e) => { e.stopPropagation(); closeTerminal(t.id); }} style={{ fontSize: 14, opacity: 0.6 }}>×</span>
        </div>
      ))}
      <button onClick={() => createTerminal()} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 16, padding: '2px 8px' }}>+</button>
    </div>
  );
}
```

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "feat: integrate xterm.js terminal with pty backend"
```

---

## 阶段六：聊天面板

### Task 7: 聊天面板 — 消息气泡 + 输入框 + @文件引用

**Files:**
- Create: `src/renderer/stores/chat.ts`
- Create: `src/renderer/components/chat/ChatPanel.tsx`
- Create: `src/renderer/components/chat/MessageBubble.tsx`
- Create: `src/renderer/components/chat/ThinkingChain.tsx`
- Create: `src/renderer/components/chat/ChatInput.tsx`

- [ ] **Step 1: 创建聊天 store**

`src/renderer/stores/chat.ts`:
```typescript
import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinkingSteps?: ThinkingStep[];
  toolCalls?: ToolCall[];
  timestamp: number;
}

export interface ThinkingStep {
  step: number;
  total: number;
  description: string;
  status: 'pending' | 'active' | 'done';
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: string;
  timestamp: number;
  status: 'running' | 'success' | 'error';
}

export interface Session {
  id: string;
  title: string;
  messages: Message[];
}

interface ChatState {
  sessions: Session[];
  activeSessionId: string | null;
  isStreaming: boolean;
  createSession: () => void;
  switchSession: (id: string) => void;
  addMessage: (msg: Message) => void;
  setStreaming: (v: boolean) => void;
  updateLastAssistant: (update: Partial<Message>) => void;
}

let sessionCounter = 0;

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  isStreaming: false,
  createSession: () => {
    sessionCounter++;
    const session: Session = {
      id: `session-${Date.now()}`,
      title: `会话 #${sessionCounter}`,
      messages: [],
    };
    set(s => ({
      sessions: [...s.sessions, session],
      activeSessionId: session.id,
    }));
  },
  switchSession: (id) => set({ activeSessionId: id }),
  addMessage: (msg) => {
    const { activeSessionId, sessions } = get();
    set({
      sessions: sessions.map(s =>
        s.id === activeSessionId ? { ...s, messages: [...s.messages, msg] } : s
      ),
    });
  },
  setStreaming: (v) => set({ isStreaming: v }),
  updateLastAssistant: (update) => {
    const { activeSessionId, sessions } = get();
    set({
      sessions: sessions.map(s => {
        if (s.id !== activeSessionId) return s;
        const msgs = [...s.messages];
        const last = msgs[msgs.length - 1];
        if (last && last.role === 'assistant') {
          msgs[msgs.length - 1] = { ...last, ...update };
        }
        return { ...s, messages: msgs };
      }),
    });
  },
}));
```

- [ ] **Step 2: 创建 MessageBubble 组件**

`src/renderer/components/chat/MessageBubble.tsx`:
```tsx
import React from 'react';
import { Message } from '../../stores/chat';
import ThinkingChain from './ThinkingChain';

interface Props {
  message: Message;
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexDirection: isUser ? 'row-reverse' : 'row' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: isUser ? 'var(--accent)' : '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
        {isUser ? '👤' : '🤖'}
      </div>
      <div style={{ maxWidth: '75%' }}>
        <div style={{
          padding: '10px 14px', borderRadius: 8,
          background: isUser ? 'var(--chat-user)' : 'var(--chat-ai)',
          border: isUser ? '1px solid rgba(124,58,237,0.3)' : '1px solid var(--border)',
          fontSize: 13, lineHeight: 1.5,
        }}>
          <div style={{ whiteSpace: 'pre-wrap' }}>{message.content || '...'}</div>
        </div>
        {message.thinkingSteps && message.thinkingSteps.length > 0 && (
          <ThinkingChain steps={message.thinkingSteps} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 创建 ThinkingChain 组件**

`src/renderer/components/chat/ThinkingChain.tsx`:
```tsx
import React, { useState } from 'react';
import { ThinkingStep } from '../../stores/chat';

interface Props {
  steps: ThinkingStep[];
}

export default function ThinkingChain({ steps }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ marginTop: 6, fontSize: 12 }}>
      <div onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>{expanded ? '▾' : '▸'}</span>
        <span>思考链 ({steps.length} 步)</span>
      </div>
      {expanded && (
        <div style={{ marginTop: 4, paddingLeft: 16 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', color: s.status === 'active' ? '#fff' : 'var(--text-secondary)' }}>
              <span>{s.status === 'done' ? '✅' : s.status === 'active' ? '💭' : '⏳'}</span>
              <span>{s.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 创建 ChatInput 组件**

`src/renderer/components/chat/ChatInput.tsx`:
```tsx
import React, { useState, useRef, useCallback } from 'react';
import { useFilesStore } from '../../stores/files';

interface Props {
  onSend: (message: string) => void;
  disabled: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState('');
  const [showMention, setShowMention] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { openTabs } = useFilesStore();

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      const trimmed = value.trim();
      if (trimmed) { onSend(trimmed); setValue(''); }
    }
    if (e.key === '@') { setShowMention(true); }
    if (e.key === 'Escape') { setShowMention(false); }
  }, [value, onSend]);

  const insertMention = (path: string) => {
    setValue(v => v + path + ' ');
    setShowMention(false);
    inputRef.current?.focus();
  };

  return (
    <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', position: 'relative' }}>
      {showMention && (
        <div style={{ position: 'absolute', bottom: '100%', left: 12, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, padding: 4, maxHeight: 160, overflow: 'auto', zIndex: 100 }}>
          {openTabs.map(t => (
            <div key={t.path} onClick={() => insertMention(t.path)} style={{ padding: '4px 8px', cursor: 'pointer', fontSize: 12, borderRadius: 3 }}>{t.name}</div>
          ))}
        </div>
      )}
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入消息... (Shift+Enter 发送, @ 引用文件)"
        disabled={disabled}
        rows={2}
        style={{
          width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6,
          color: 'var(--text-primary)', padding: '8px 12px', fontSize: 13, resize: 'none', fontFamily: 'inherit',
          outline: 'none',
        }}
      />
    </div>
  );
}
```

- [ ] **Step 5: 创建 ChatPanel 容器**

`src/renderer/components/chat/ChatPanel.tsx`:
```tsx
import React, { useRef, useEffect } from 'react';
import { useChatStore } from '../../stores/chat';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';

export default function ChatPanel() {
  const { sessions, activeSessionId, isStreaming, addMessage } = useChatStore();
  const endRef = useRef<HTMLDivElement>(null);

  const session = sessions.find(s => s.id === activeSessionId);
  const messages = session?.messages ?? [];

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = (content: string) => {
    addMessage({ id: `msg-${Date.now()}`, role: 'user', content, timestamp: Date.now() });
    // Agent invocation will be wired in later tasks
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
            <div style={{ fontSize: 14 }}>开始与 DeepSeek Agent 对话</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>输入消息或 @ 引用文件</div>
          </div>
        )}
        {messages.map(msg => <MessageBubble key={msg.id} message={msg} />)}
        <div ref={endRef} />
      </div>
      <ChatInput onSend={handleSend} disabled={isStreaming} />
    </div>
  );
}
```

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat: add chat panel with message bubbles, thinking chain, and @ file mention"
```

---

## 阶段七：Agent 引擎 + DeepSeek API

### Task 8: DeepSeek API 客户端 + KV Cache 管理

**Files:**
- Create: `src/main/agent/client.ts`
- Create: `src/main/agent/cache.ts`

- [ ] **Step 1: 编写 API 客户端测试**

由于 Electron 主进程难以直接运行 vitest，我们先写代码，功能验证通过集成测试完成。

- [ ] **Step 2: 实现 KV Cache 前缀管理器**

`src/main/agent/cache.ts`:
```typescript
export interface CachePrefix {
  systemPrompt: string;
  projectContext: string;
}

let cachedPrefix: CachePrefix | null = null;
let lastHash = '';

function hash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

export function buildCachePrefix(systemPrompt: string, projectContext: string): CachePrefix {
  const h = hash(systemPrompt + projectContext);
  if (h === lastHash && cachedPrefix) return cachedPrefix;
  cachedPrefix = { systemPrompt, projectContext };
  lastHash = h;
  return cachedPrefix;
}

export function buildMessages(
  prefix: CachePrefix,
  history: Array<{ role: string; content: string }>,
  newMessage: string
) {
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: prefix.systemPrompt },
  ];
  if (prefix.projectContext) {
    messages.push({ role: 'system', content: prefix.projectContext });
  }
  messages.push(...history);
  messages.push({ role: 'user', content: newMessage });
  return messages;
}
```

- [ ] **Step 3: 实现 DeepSeek streaming client**

`src/main/agent/client.ts`:
```typescript
import https from 'https';

export interface StreamCallbacks {
  onContent: (text: string) => void;
  onToolCall: (tool: { name: string; arguments: string }) => void;
  onThinking: (step: { step: number; total: number; description: string }) => void;
  onDone: () => void;
  onError: (err: Error) => void;
}

export async function streamChat(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  tools: Array<unknown>,
  callbacks: StreamCallbacks
): Promise<void> {
  const body = JSON.stringify({
    model: 'deepseek-chat',
    messages,
    tools,
    stream: true,
    stream_options: { include_usage: true },
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.deepseek.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'text/event-stream',
      },
    }, (res) => {
      let buffer = '';
      res.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') { callbacks.onDone(); resolve(); continue; }
          try {
            const parsed = JSON.parse(data);
            const choice = parsed.choices?.[0];
            // DeepSeek 兼容 reasoning_content 扩展字段
            if (choice?.delta?.reasoning_content) {
              callbacks.onThinking({
                step: 0, total: 0,
                description: choice.delta.reasoning_content,
              });
            }
            if (choice?.delta?.content) {
              callbacks.onContent(choice.delta.content);
            }
            if (choice?.delta?.tool_calls) {
              for (const tc of choice.delta.tool_calls) {
                if (tc.function) {
                  callbacks.onToolCall({ name: tc.function.name, arguments: tc.function.arguments ?? '{}' });
                }
              }
            }
          } catch {}
        }
      });
      res.on('end', () => { callbacks.onDone(); resolve(); });
    });
    req.on('error', (err) => { callbacks.onError(err); reject(err); });
    req.write(body);
    req.end();
  });
}
```

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat: add DeepSeek API streaming client with KV cache prefix manager"
```

### Task 9: Agent 工具实现

**Files:**
- Create: `src/main/agent/tools.ts`
- Create: `src/main/agent/context.ts`

- [ ] **Step 1: 实现工具注册表**

`src/main/agent/tools.ts`:
```typescript
import fs from 'fs';
import path from 'path';

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<string>;
  requiresConfirm?: boolean;
}

export function getAllTools(projectDir: string): ToolDef[] {
  return [
    {
      name: 'read_file',
      description: '读取文件内容',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件路径（相对于项目根目录或绝对路径）' },
          offset: { type: 'number', description: '开始行号' },
          limit: { type: 'number', description: '读取行数' },
        },
        required: ['path'],
      },
      execute: async (args) => {
        const filePath = path.resolve(projectDir, args.path as string);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const start = ((args.offset as number) ?? 1) - 1;
        const end = args.limit ? start + (args.limit as number) : lines.length;
        return lines.slice(start, end).map((l, i) => `${start + i + 1}: ${l}`).join('\n');
      },
    },
    {
      name: 'write_file',
      description: '写入/创建文件',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件路径' },
          content: { type: 'string', description: '文件内容' },
        },
        required: ['path', 'content'],
      },
      requiresConfirm: true,
      execute: async (args) => {
        const filePath = path.resolve(projectDir, args.path as string);
        const dir = path.dirname(filePath);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, args.content as string, 'utf-8');
        return `文件已写入: ${filePath}`;
      },
    },
    {
      name: 'edit_file',
      description: '精确字符串替换编辑文件',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件路径' },
          old_string: { type: 'string', description: '要替换的文本' },
          new_string: { type: 'string', description: '替换后的文本' },
        },
        required: ['path', 'old_string', 'new_string'],
      },
      requiresConfirm: true,
      execute: async (args) => {
        const filePath = path.resolve(projectDir, args.path as string);
        let content = fs.readFileSync(filePath, 'utf-8');
        if (!content.includes(args.old_string as string)) {
          throw new Error('old_string 未在文件中找到');
        }
        content = content.replace(args.old_string as string, args.new_string as string);
        fs.writeFileSync(filePath, content, 'utf-8');
        return `文件已编辑: ${filePath}`;
      },
    },
    {
      name: 'grep',
      description: '在项目中搜索文本',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: '搜索正则或文本' },
          path: { type: 'string', description: '搜索路径（默认项目根目录）' },
          glob: { type: 'string', description: '文件过滤 glob' },
        },
        required: ['pattern'],
      },
      execute: async (args) => {
        // Simplified: use child process to run grep
        const { execSync } = await import('child_process');
        const searchPath = args.path ? path.resolve(projectDir, args.path as string) : projectDir;
        const cmd = `grep -rn --include="${args.glob || '*'}" "${args.pattern}" "${searchPath}"`;
        try {
          return execSync(cmd, { encoding: 'utf-8', maxBuffer: 1024 * 1024 });
        } catch {
          return '未找到匹配项';
        }
      },
    },
    {
      name: 'glob',
      description: '文件模式匹配',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'glob 模式，如 **/*.ts' },
        },
        required: ['pattern'],
      },
      execute: async (args) => {
        const { glob } = await import('glob');
        const files = await glob(args.pattern as string, { cwd: projectDir });
        return files.join('\n');
      },
    },
    {
      name: 'bash',
      description: '执行终端命令',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: '要执行的命令' },
        },
        required: ['command'],
      },
      requiresConfirm: true,
      execute: async (args) => {
        const { execSync } = await import('child_process');
        return execSync(args.command as string, { encoding: 'utf-8', maxBuffer: 1024 * 1024, cwd: projectDir });
      },
    },
    {
      name: 'list_files',
      description: '列出目录内容',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '目录路径（默认项目根目录）' },
        },
      },
      execute: async (args) => {
        const dirPath = args.path ? path.resolve(projectDir, args.path as string) : projectDir;
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        return entries.map(e => `${e.isDirectory() ? 'd' : 'f'} ${e.name}`).join('\n');
      },
    },
  ];
}

export function getToolSchemas(tools: ToolDef[]) {
  return tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}
```

- [ ] **Step 2: 实现项目上下文构建器**

`src/main/agent/context.ts`:
```typescript
import fs from 'fs';
import path from 'path';

const MAX_CONTEXT_FILES = 20;
const MAX_CONTEXT_SIZE = 8000;

export function buildProjectContext(projectDir: string): string {
  const parts: string[] = [];
  const importantFiles = findImportantFiles(projectDir);

  parts.push(`项目目录: ${projectDir}`);
  parts.push('');

  let totalSize = 0;
  for (const file of importantFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const truncated = content.length > 500
        ? content.slice(0, 500) + '\n... (截断)'
        : content;
      parts.push(`--- ${path.relative(projectDir, file)} ---`);
      parts.push(truncated);
      totalSize += truncated.length;
      if (totalSize > MAX_CONTEXT_SIZE) break;
    } catch {}
  }

  return parts.join('\n');
}

function findImportantFiles(dir: string): string[] {
  const important = new Set([
    'package.json', 'tsconfig.json', 'README.md',
    '.env.example', 'docker-compose.yml', 'Makefile',
  ]);
  const found: string[] = [];

  function walk(d: string, depth: number) {
    if (depth > 3 || found.length > MAX_CONTEXT_FILES) return;
    try {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const full = path.join(d, entry.name);
        if (entry.isFile() && important.has(entry.name)) {
          found.push(full);
        } else if (entry.isDirectory()) {
          walk(full, depth + 1);
        }
      }
    } catch {}
  }

  walk(dir, 0);
  return found;
}
```

- [ ] **Step 3: 安装 glob 依赖**

```bash
npm install glob
```

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat: add agent tool implementations and project context builder"
```

### Task 10: Agent IPC Handler — 串联 API + 工具

**Files:**
- Create: `src/main/ipc/agent.ts`

- [ ] **Step 1: 实现 Agent handler**

`src/main/ipc/agent.ts`:
```typescript
import { ipcMain, BrowserWindow } from 'electron';
import { streamChat } from '../agent/client';
import { buildCachePrefix, buildMessages } from '../agent/cache';
import { getAllTools, getToolSchemas, ToolDef } from '../agent/tools';
import { buildProjectContext } from '../agent/context';

const SYSTEM_PROMPT = `You are DeepSeek Agent, a coding assistant. You can:
- Read, write, and edit files
- Search code with grep
- Execute shell commands
- List directory contents

Always think step by step. When editing files, use the edit_file tool to make precise changes.`;

let activeAbort: (() => void) | null = null;
let tools: ToolDef[] = [];

export function setupAgentHandlers() {
  ipcMain.handle('agent:send', async (event, payload: {
    messages: Array<{ role: string; content: string }>;
    apiKey: string;
    projectDir: string;
    newMessage: string;
  }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) throw new Error('No window');

    tools = getAllTools(payload.projectDir);
    const projectContext = buildProjectContext(payload.projectDir);
    const prefix = buildCachePrefix(SYSTEM_PROMPT, projectContext);
    const messages = buildMessages(prefix, payload.messages, payload.newMessage);

    let contentBuffer = '';
    let thinkingSteps: Array<{ step: number; total: number; description: string; status: string }> = [];

    await streamChat(
      payload.apiKey,
      messages,
      getToolSchemas(tools),
      {
        onContent: (text) => {
          contentBuffer += text;
          win.webContents.send('agent:stream-chunk', { type: 'content', text });
        },
        onToolCall: async (tc) => {
          const tool = tools.find(t => t.name === tc.name);
          win.webContents.send('agent:stream-chunk', {
            type: 'tool-call',
            name: tc.name,
            args: tc.arguments,
            status: 'running',
          });
          try {
            const args = JSON.parse(tc.arguments);
            const result = await tool!.execute(args);
            win.webContents.send('agent:stream-chunk', {
              type: 'tool-result',
              name: tc.name,
              result,
              status: 'success',
            });
          } catch (err: any) {
            win.webContents.send('agent:stream-chunk', {
              type: 'tool-result',
              name: tc.name,
              result: err.message,
              status: 'error',
            });
          }
        },
        onThinking: (step) => {
          thinkingSteps.push({ ...step, status: 'active' });
          win.webContents.send('agent:stream-chunk', { type: 'thinking', steps: thinkingSteps });
        },
        onDone: () => {
          win.webContents.send('agent:stream-chunk', { type: 'done' });
        },
        onError: (err) => {
          win.webContents.send('agent:stream-chunk', { type: 'error', message: err.message });
        },
      }
    );
    return { success: true };
  });

  ipcMain.handle('agent:cancel', async () => {
    activeAbort?.();
    return { success: true };
  });
}
```

- [ ] **Step 2: 提交**

```bash
git add -A
git commit -m "feat: wire agent IPC handler with full streaming and tool execution"
```

---

## 阶段八：Agent 可观测面板

### Task 11: Agent 面板 — 步骤进度 + 工具时间线 + Token 统计

**Files:**
- Create: `src/renderer/stores/agent.ts`
- Create: `src/renderer/components/agent/AgentPanel.tsx`
- Create: `src/renderer/components/agent/CurrentStep.tsx`
- Create: `src/renderer/components/agent/ToolTimeline.tsx`
- Create: `src/renderer/components/agent/TokenUsage.tsx`

- [ ] **Step 1: 创建 Agent store**

`src/renderer/stores/agent.ts`:
```typescript
import { create } from 'zustand';

export interface ToolCallEntry {
  id: string;
  name: string;
  args: string;
  result?: string;
  status: 'running' | 'success' | 'error';
  timestamp: number;
}

export interface TokenStats {
  total: number;
  prompt: number;
  completion: number;
  contextWindow: number;
  contextMax: number;
  cost: number;
}

interface AgentState {
  currentStep: { step: number; total: number; description: string; progress: number } | null;
  toolCalls: ToolCallEntry[];
  tokenStats: TokenStats | null;
  setCurrentStep: (step: AgentState['currentStep']) => void;
  addToolCall: (tc: ToolCallEntry) => void;
  updateToolCall: (id: string, update: Partial<ToolCallEntry>) => void;
  setTokenStats: (stats: TokenStats) => void;
  reset: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  currentStep: null,
  toolCalls: [],
  tokenStats: null,
  setCurrentStep: (step) => set({ currentStep: step }),
  addToolCall: (tc) => set(s => ({ toolCalls: [...s.toolCalls, tc] })),
  updateToolCall: (id, update) => set(s => ({
    toolCalls: s.toolCalls.map(t => t.id === id ? { ...t, ...update } : t),
  })),
  setTokenStats: (stats) => set({ tokenStats: stats }),
  reset: () => set({ currentStep: null, toolCalls: [], tokenStats: null }),
}));
```

- [ ] **Step 2: 创建 CurrentStep 组件**

`src/renderer/components/agent/CurrentStep.tsx`:
```tsx
import React from 'react';
import { useAgentStore } from '../../stores/agent';

export default function CurrentStep() {
  const { currentStep } = useAgentStore();
  if (!currentStep) return null;

  return (
    <div style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>Current Step</div>
      <div style={{ fontSize: 12, marginBottom: 4 }}>
        Step {currentStep.step} of {currentStep.total}
      </div>
      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 4, height: 6, marginBottom: 4 }}>
        <div style={{ width: `${currentStep.progress}%`, height: '100%', background: 'var(--accent)', borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{currentStep.description}</div>
    </div>
  );
}
```

- [ ] **Step 3: 创建 ToolTimeline 组件**

`src/renderer/components/agent/ToolTimeline.tsx`:
```tsx
import React from 'react';
import { useAgentStore, ToolCallEntry } from '../../stores/agent';

function ToolCallRow({ tc }: { tc: ToolCallEntry }) {
  const statusIcon = tc.status === 'running' ? '🔄' : tc.status === 'success' ? '✅' : '❌';
  const time = new Date(tc.timestamp).toLocaleTimeString();

  return (
    <div style={{ fontSize: 11, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>{statusIcon}</span>
        <span style={{ color: 'var(--accent)' }}>{tc.name}</span>
        <span style={{ color: 'var(--text-secondary)', marginLeft: 'auto' }}>{time}</span>
      </div>
      <div style={{ color: 'var(--text-secondary)', fontSize: 10, marginTop: 2, paddingLeft: 20 }}>
        {tc.args}
      </div>
      {tc.result && (
        <div style={{ color: 'var(--text-secondary)', fontSize: 10, marginTop: 2, paddingLeft: 20, opacity: 0.7, maxHeight: 40, overflow: 'hidden' }}>
          {tc.result.slice(0, 100)}
        </div>
      )}
    </div>
  );
}

export default function ToolTimeline() {
  const { toolCalls } = useAgentStore();

  return (
    <div style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase' }}>Tool Call Timeline</div>
      {toolCalls.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.5 }}>等待工具调用...</div>
      )}
      {toolCalls.map(tc => <ToolCallRow key={tc.id} tc={tc} />)}
    </div>
  );
}
```

- [ ] **Step 4: 创建 TokenUsage 组件**

`src/renderer/components/agent/TokenUsage.tsx`:
```tsx
import React from 'react';
import { useAgentStore } from '../../stores/agent';

export default function TokenUsage() {
  const { tokenStats } = useAgentStore();
  if (!tokenStats) return null;

  const promptPct = (tokenStats.prompt / tokenStats.total * 100).toFixed(1);
  const completionPct = (tokenStats.completion / tokenStats.total * 100).toFixed(1);
  const ctxPct = (tokenStats.contextWindow / tokenStats.contextMax * 100).toFixed(1);

  return (
    <div style={{ padding: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase' }}>Token Usage</div>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Total: {tokenStats.total.toLocaleString()}</div>
      <div style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span>Prompt</span>
        <span>{tokenStats.prompt.toLocaleString()} ({promptPct}%)</span>
      </div>
      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 4, height: 4, marginBottom: 6 }}>
        <div style={{ width: `${promptPct}%`, height: '100%', background: '#6366f1', borderRadius: 4 }} />
      </div>
      <div style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span>Completion</span>
        <span>{tokenStats.completion.toLocaleString()} ({completionPct}%)</span>
      </div>
      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 4, height: 4, marginBottom: 6 }}>
        <div style={{ width: `${completionPct}%`, height: '100%', background: '#22c55e', borderRadius: 4 }} />
      </div>
      <div style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span>Context Window</span>
        <span>{tokenStats.contextWindow.toLocaleString()} / {tokenStats.contextMax.toLocaleString()} ({ctxPct}%)</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
        💰 预估费用: ¥{tokenStats.cost.toFixed(4)}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 创建 AgentPanel 容器**

`src/renderer/components/agent/AgentPanel.tsx`:
```tsx
import React from 'react';
import CurrentStep from './CurrentStep';
import ToolTimeline from './ToolTimeline';
import TokenUsage from './TokenUsage';

export default function AgentPanel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <div style={{ padding: 10, fontWeight: 600, fontSize: 13, borderBottom: '1px solid var(--border)' }}>
        🧠 Agent 可观测
      </div>
      <CurrentStep />
      <ToolTimeline />
      <TokenUsage />
    </div>
  );
}
```

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat: add agent observability panel with steps, tool timeline, and token stats"
```

---

## 阶段九：持久化与设置

### Task 12: SQLite 持久化 + API Key 管理

**Files:**
- Create: `src/main/db/connection.ts`
- Create: `src/main/db/sessions.ts`
- Create: `src/main/db/settings.ts`
- Create: `src/main/security/keystore.ts`
- Create: `src/main/ipc/settings.ts`

- [ ] **Step 1: 创建数据库连接**

`src/main/db/connection.ts`:
```typescript
import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  const dbPath = path.join(app.getPath('userData'), 'deepseek-agent.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  initSchema();
  return db;
}

function initSchema() {
  db!.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      messages TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}
```

- [ ] **Step 2: 创建会话持久化**

`src/main/db/sessions.ts`:
```typescript
import { getDb } from './connection';

export function saveSession(id: string, title: string, messages: string) {
  const db = getDb();
  const now = Date.now();
  db.prepare(`
    INSERT INTO sessions (id, title, messages, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET title=?, messages=?, updated_at=?
  `).run(id, title, messages, now, now, title, messages, now);
}

export function loadSessions(): Array<{ id: string; title: string; messages: string }> {
  const db = getDb();
  return db.prepare('SELECT id, title, messages FROM sessions ORDER BY updated_at DESC').all() as any[];
}

export function deleteSession(id: string) {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
}
```

- [ ] **Step 3: 创建设置存取**

`src/main/db/settings.ts`:
```typescript
import { getDb } from './connection';

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  const db = getDb();
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=?').run(key, value, value);
}
```

- [ ] **Step 4: 创建 API Key 加密存储**

`src/main/security/keystore.ts`:
```typescript
import { safeStorage } from 'electron';
import { setSetting, getSetting } from '../db/settings';

export function saveApiKey(key: string) {
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(key);
    setSetting('api_key_encrypted', encrypted.toString('base64'));
  } else {
    // Fallback: store in plaintext with warning
    setSetting('api_key', key);
  }
}

export function getApiKey(): string | null {
  if (safeStorage.isEncryptionAvailable()) {
    const encryptedB64 = getSetting('api_key_encrypted');
    if (!encryptedB64) return null;
    const encrypted = Buffer.from(encryptedB64, 'base64');
    return safeStorage.decryptString(encrypted);
  }
  return getSetting('api_key');
}
```

- [ ] **Step 5: 创建设置 IPC handler**

`src/main/ipc/settings.ts`:
```typescript
import { ipcMain } from 'electron';
import { getApiKey, saveApiKey } from '../security/keystore';
import { getSetting, setSetting } from '../db/settings';

export function setupSettingsHandlers() {
  ipcMain.handle('settings:get', async (_event, key: string) => getSetting(key));
  ipcMain.handle('settings:set', async (_event, key: string, value: string) => {
    setSetting(key, value);
    return { success: true };
  });
  ipcMain.handle('settings:getApiKey', async () => getApiKey());
  ipcMain.handle('settings:setApiKey', async (_event, key: string) => {
    saveApiKey(key);
    return { success: true };
  });
}
```

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat: add SQLite persistence and encrypted API key storage"
```

---

## 阶段十：串联集成

### Task 13: 串联所有组件，完成端到端可用

**Files:**
- Modify: `src/main/index.ts` — 注册所有 IPC handler
- Modify: `src/renderer/App.tsx` — 集成所有面板
- Modify: `src/preload/index.ts` — 补齐类型安全的 API 方法

- [ ] **Step 1: 更新主进程入口注册所有 handler**

`src/main/index.ts` 中 createWindow 之前：
```typescript
import { registerAllHandlers } from './ipc';

app.whenReady().then(() => {
  registerAllHandlers();
  createWindow();
});
```

- [ ] **Step 2: 更新 App.tsx 集成全部面板**

`src/renderer/App.tsx`:
```tsx
import React from 'react';
import AppShell from './components/layout/AppShell';
import Sidebar from './components/sidebar/Sidebar';
import ChatPanel from './components/chat/ChatPanel';
import AgentPanel from './components/agent/AgentPanel';
import EditorTabs from './components/editor/EditorTabs';
import CodeEditor from './components/editor/CodeEditor';
import TerminalPanel from './components/terminal/TerminalPanel';
import TerminalTabs from './components/terminal/TerminalTabs';
import { useFilesStore } from './stores/files';
import { useTerminalStore } from './stores/terminal';
import { useChatStore } from './stores/chat';
import { useLayoutStore } from './stores/layout';
import ResizeHandle from './components/layout/ResizeHandle';

export default function App() {
  const { activeTab, openTabs } = useFilesStore();
  const { activeTermId } = useTerminalStore();
  const { activeSessionId } = useChatStore();
  const { sidebarWidth, agentPanelWidth, terminalHeight, setSidebarWidth, setAgentPanelWidth, setTerminalHeight } = useLayoutStore();
  const activeFile = openTabs.find(t => t.path === activeTab);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ width: sidebarWidth, flexShrink: 0, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', height: '100%', overflow: 'hidden' }}>
          <Sidebar />
        </div>
        <ResizeHandle direction="horizontal" onResize={(d) => setSidebarWidth(Math.max(180, sidebarWidth - d))} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <EditorTabs />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {activeFile ? (
                <CodeEditor content="// 文件通过 IPC 加载" language="typescript" />
              ) : (
                <div style={{ height: '50%', overflow: 'hidden' }}>
                  {activeSessionId ? <ChatPanel /> : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>新建会话开始对话</div>}
                </div>
              )}
            </div>
            {activeFile && (
              <div style={{ height: '35%', overflow: 'hidden', borderTop: '1px solid var(--border)' }}>
                {activeSessionId ? <ChatPanel /> : null}
              </div>
            )}
          </div>
        </div>
        <ResizeHandle direction="horizontal" onResize={(d) => setAgentPanelWidth(Math.max(200, agentPanelWidth + d))} />
        <div style={{ width: agentPanelWidth, flexShrink: 0, background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)', height: '100%', overflow: 'hidden' }}>
          <AgentPanel />
        </div>
      </div>
      <ResizeHandle direction="vertical" onResize={(d) => setTerminalHeight(Math.max(80, terminalHeight + d))} />
      <div style={{ height: terminalHeight, flexShrink: 0, background: 'var(--terminal-bg)', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <TerminalTabs />
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {activeTermId && <TerminalPanel termId={activeTermId} />}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 更新 preload 补齐 API 方法**

`src/preload/index.ts` 增加 settings、sessions、terminal destroy 方法。

- [ ] **Step 4: 添加 TypeScript 全局类型声明**

`src/renderer/types.d.ts`:
```typescript
import type { API } from '../preload/index';

declare global {
  interface Window {
    api: API;
  }
}
```

- [ ] **Step 5: 添加 .gitignore**

```
node_modules/
dist/
out/
.deepseek-agent/
.env
*.db
```

- [ ] **Step 6: 端到端验证**

```bash
npm start
```

期望结果：
1. 窗口打开显示四区域布局
2. 可以在终端输入命令
3. 可以打开文件树浏览
4. 可以发送聊天消息
5. 配置 API Key 后与 DeepSeek 交互
6. Agent 面板实时显示工具调用

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "feat: integrate all panels for end-to-end functionality"
```

---

## 验证清单

完成所有任务后验证以下功能：

- [ ] 四区域布局可拖拽调整大小，最小宽度限制生效
- [ ] 侧边栏 Tab 切换正常（文件树 ↔ 会话列表）
- [ ] 文件树展开/折叠，点击文件打开到编辑器 Tab
- [ ] Monaco Editor 语法高亮，多 Tab 切换
- [ ] Diff 预览显示差异
- [ ] 终端启动、多终端、命令执行
- [ ] 聊天消息发送、AI 回复流式显示
- [ ] 思考链展开/折叠
- [ ] @ 文件引用弹窗
- [ ] Agent 面板工具调用时间线实时更新
- [ ] Token 统计柱状图
- [ ] 会话创建/切换/持久化
- [ ] API Key 加密存储与读取
- [ ] KV Cache 前缀稳定性验证
