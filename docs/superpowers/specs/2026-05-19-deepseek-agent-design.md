# DeepSeek Agent 桌面应用设计文档

## 概述

一个基于 Electron 的桌面 Agent 应用，专为 DeepSeek API 设计。提供编程助手 + Agent 运行时可视化能力。用户群体：个人开发者日常编程辅助和深度调试。

参考产品形态：Cursor IDE + Claude Code Desktop。

## 技术栈

- **框架**：Electron（Cursor/VS Code 同款技术栈，Monaco Editor 生态成熟）
- **前端**：React + TypeScript
- **构建工具**：Vite + electron-forge
- **代码编辑器**：Monaco Editor
- **终端**：xterm.js
- **持久化**：better-sqlite3（会话、设置、项目元数据）
- **API**：DeepSeek API（内置 OpenAI 兼容适配层，后续可扩展）

## 整体布局

四区域布局（从参考设计图确认）：

```
┌──────────┬──────────────────────┬──────────────┐
│ Sidebar  │   Main Area          │  Agent Panel │
│ 240px    │   (Tabs + Editor     │  280px       │
│          │    + Chat)           │              │
│ File Tree│                      │  Steps       │
│ Sessions │                      │  Tool Calls  │
│          │                      │  Token Stats │
├──────────┴──────────────────────┴──────────────┤
│  Terminal (xterm.js)                           │
│   Problems | Output | Debug Console | bash     │
└────────────────────────────────────────────────┘
```

### 1. 侧边栏 (240px)

顶部 Tab 切换两个视图：
- **文件资源管理器**：项目文件树，支持展开/折叠、文件图标
- **会话列表**（CHAT SESSIONS）：历史对话列表，可切换/新建

### 2. 主区域

- **Tab 栏**：打开的文件标签页（可关闭）+ 聊天标签页
- **上半部分 — 代码编辑器**：Monaco Editor，语法高亮、行号、diff 视图
- **下半部分 — 聊天面板**：
  - 用户消息气泡（蓝色调）
  - AI 回复气泡（深灰调），内嵌可展开的思考链卡片
  - 输入框支持 `@` 引用文件

### 3. Agent 可观测面板 (280px)

- **CURRENT STEP**：当前执行步骤，进度条（如 Step 3 of 5, 60%），步骤描述
- **TOOL CALL TIMELINE**：工具调用时间线，包含工具名、参数、时间戳、token 消耗
- **TOKEN USAGE**：
  - Total Tokens
  - Prompt Tokens (占比 %)
  - Completion Tokens (占比 %)
  - Context Window 使用量（如 24,521 / 100,000）

### 4. 底部终端

- xterm.js 集成终端
- Tab 切换：Problems | Output | Debug Console | 终端实例
- 支持多终端实例 (+ 新建)

## 核心功能

### 编程助手

- 代码生成、重构、解释
- 多文件编辑
- 项目上下文（扫描目录结构、读取关键文件，作为 system prompt 的一部分注入）
- Diff 预览和接受/拒绝

### Agent 运行时可视化

- 实时展示 DeepSeek 思考链（thinking chain）
- 工具调用流式展示（工具名、参数、结果摘要）
- 步骤进度追踪
- Token 消耗实时统计

### 文件管理

- 文件树浏览
- 文件创建/编辑/删除
- @ 文件引用（在聊天中快速引用项目文件）

### Agent 工具集

Agent 可用的内置工具（通过 function calling）：

- `read_file(path, offset?, limit?)` — 读取文件内容
- `write_file(path, content)` — 写入/创建文件
- `edit_file(path, old_string, new_string)` — 精确字符串替换
- `grep(pattern, path?, glob?)` — 项目内搜索
- `glob(pattern)` — 文件模式匹配
- `bash(command)` — 执行终端命令（需用户确认）
- `list_files(path)` — 列出目录

工具调用统一在 Main Process 执行，渲染进程只展示结果。危险操作（bash、文件删除）需用户确认。

### 会话管理

- 多会话并存
- 会话历史持久化
- 会话搜索

## 数据流

```
用户输入 → Chat Panel → Electron Main Process
    → DeepSeek API (streaming)
    → Renderer Process 显示流式响应
    → 解析思考链/工具调用 → Agent Panel 实时更新
    → 工具执行 (Main Process) → 结果回传给 API
    → 最终响应展示
```

## API 对接

- 仅对接 DeepSeek 官方 API
- 用户配置 API Key（本地加密存储）
- 支持 streaming 响应
- 架构预留多供应商扩展接口

### KV Cache 优化

DeepSeek API 支持自动上下文缓存（KV Cache 复用）。调用策略：

- **固定前缀**：System Prompt + 项目上下文始终放在 messages 数组最前面，保持前缀稳定
- **变化尾部**：对话历史追加在末尾，只有从变化点往后的部分需重新计算
- **缓存效果**：System Prompt 和项目上下文几乎 100% 命中，大幅降低首 token 延迟和费用
- **无额外 API 调用**：服务端自动处理，客户端只需保证 messages 顺序约定

## 配色方案

- 背景：深色 #1e1e2e
- 强调色：紫色 #7c3aed
- 终端背景：#0d0d0d
- 代码区：VS Code Dark+ 主题色

## 不纳入范围

- 拖拽式工作流编排（Dify 式）
- 多供应商支持（仅 DeepSeek，架构可扩展）
- 团队协作功能
- 本地模型推理
