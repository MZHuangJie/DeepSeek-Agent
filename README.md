# DeepSeek Agent

基于 Electron + React + TypeScript 构建的桌面端 AI 编程助手。支持 **OpenAI**、**Anthropic（原生 API）**、**Google Gemini**、**DeepSeek**、**通义千问**、**智谱 GLM**、**Moonshot** 等多种大模型，提供代码编写、项目管理、AI 对话、角色扮演、角色广场、网络搜索、图片生成等一站式开发体验。

## 功能介绍

### AI 对话
- 支持 **编程助手**、**聊天**、**角色扮演**、**计划模式**、**Multi-Agent** 五种模式
- 流式输出，实时显示思考过程（Thinking Chain）和工具调用
- 多轮工具调用自动分解为独立消息气泡
- 引用文件 Chip 系统，拖拽或右键添加文件到对话上下文
- 命令系统：`/plan`、`/review`、`/coding`、`/brainstorming`、`/debugging`、`/tdd`、`/image`、`/browse` 等
- 消息操作：复制、重新发送、添加到对话
- **Markdown 渲染**：支持 GitHub Flavored Markdown（粗体/斜体/表格/代码块/列表/引用/emoji）
- **图片粘贴**：支持粘贴剪贴板图片到对话，自动上传并展示
- **会话标题自动生成**：首轮对话后 AI 自动生成会话摘要标题

### Agent 工具
- **文件操作**：读取、写入、编辑、删除、列出目录、搜索代码（grep/glob）
- **终端执行**：内置终端，支持多实例、多 Shell（PowerShell/cmd/bash）
- **子代理**：大型项目自动拆分任务并行探索
- **生图**：调用多种生图模型，支持 base64 和 URL 两种输出，可配置 API 类型（images/chat）和扩展参数
- **网页交互**：`present_web` 工具启动本地 HTTP 服务，生成交互式 HTML 页面，非交互页面自动注入关闭按钮
- **网络搜索**：DuckDuckGo 搜索
- **网页抓取**：Electron 内嵌 Chromium 抓取网页文本内容
- **网页截图**：对指定 URL 截图并保存到项目目录
- **图片理解**：调用视觉模型描述图片内容

### 文件管理
- 文件树浏览器，支持创建、重命名、删除文件和文件夹
- 右键菜单：新建、重命名、删除、添加到对话、在资源管理器中打开、在浏览器中打开
- 最近打开的工作区列表，支持删除历史记录
- 隐藏文件显示，无 node_modules 过滤

### 代码编辑器
- Monaco Editor，支持 TypeScript/JavaScript/Python/JSON/CSS/HTML 等语法高亮
- 图片查看器，支持 PNG/JPG/GIF/WebP/SVG，点击缩放
- 未保存状态指示（标签页圆点标记）
- Ctrl+S 保存文件

### 视图系统
- 左侧 Activity Bar 图标切换面板（文件/会话/浏览器/Agent 观测）
- 面板滑动展开/收起动画
- 内嵌浏览器（webview），导航栏支持后退/前进/刷新/地址栏
- "发送给 AI"按钮提取当前页面内容
- 右侧 Agent 观测面板：工具调用时间线、探索进度、Token 用量统计、余额查询

### 终端
- 基于 node-pty 的真实终端模拟
- 支持多终端实例，Tab 切换
- 切换工作区自动 cd 到新目录

### 插件系统
- GitHub 仓库作为插件源，git clone 浅克隆获取技能文件
- 插件管理器 UI，支持发现、安装、卸载
- 内置技能文件（plan/code-review/brainstorming/debugging/tdd/coding）

### 角色系统
- **角色管理**：创建、编辑、删除角色，基于模板创建
- **模板系统**：预设角色模板，支持复制、编辑、自定义状态字段
- **AI 生成立绘**：调用生图模型自动生成角色立绘，支持多种画风，可自定义 Prompt 生成指令
- **角色扮演聊天**：选择角色后进入沉浸式角色扮演对话，支持群像多人模式
- **玩家名称**：登录用户自动使用账号名，未登录可自定义

### 账户中心
- 个人账户概览：云端角色/模板/会话统计，最近活动
- 个人资料编辑：用户名、邮箱、头像（支持压缩上传）
- 角色卡片管理：查看、编辑、云端同步、分享到广场、删除
- 模板云端管理：上传、恢复、分享、删除
- 对话历史：云端会话列表，恢复本地、删除
- **自定义 Toast/Confirm**：替代原生弹窗，风格统一

### 角色广场
- **浏览广场**：查看所有用户分享的角色，支持搜索、性别/标签筛选、按热度/时间排序
- **收藏系统**：收藏感兴趣的角色到收藏夹，作者取消分享后置灰标注不会静默消失
- **角色详情**：点击卡片弹出左右分栏详情浮层——立绘完整展示 + 全部设定信息
- **一键恢复**：广场/收藏夹均可直接恢复到本地
- **发起聊天**：已恢复角色可从详情面板一键创建会话并开始角色扮演

### 云端同步
- 自建服务端，独立部署
- 对话会话、角色卡片、模板备份/恢复到云端
- 确认删除云端数据
- PostgreSQL 数据存储，用户数据隔离
- JWT 认证，Electron safeStorage 加密存储 Token

### 模型管理
- 支持多模型切换，自定义 API Key/Base URL
- 按提供商预设默认参数（OpenAI / Anthropic / Gemini / DeepSeek / 通义千问 / 智谱 / Moonshot）
- Anthropic 原生 Messages API 支持（流式 SSE、Thinking、Tool Use）
- 每个模型可单独配置 API Key（留空使用全局 Key）
- 上下文窗口可调，用于 Token 预估和自动压缩

### 生图模型
- 独立配置：API 类型（images API / chat completions）、模型 ID、Base URL、API Key
- **扩展参数**：JSON 自由配置模型特有参数，无需改代码适配新模型
- **Prompt 生成指令**：自定义角色立绘 Prompt 的生成策略
- Gemini 生图支持（通过 chat completions + extra_body 配置）
- base64 图片自动存入 `.deepseek-agent-images/` 避免撑爆上下文

### 其他
- Token 用量实时统计
- 探索进度：已读文件数/总数、百分比进度条
- 操作确认弹框，支持"本次会话内自动允许"
- 选择弹框（ChoiceDialog），多选 + 反馈输入

## 安装与运行

### 环境要求

- Node.js >= 18
- Windows 10/11（macOS/Linux 需自行测试）
- Git

### 开发模式

```bash
# 克隆仓库
git clone https://github.com/MZHuangJie/DeepSeek-Agent.git
cd DeepSeek-Agent

# 安装依赖
npm install

# 启动开发模式（Vite HMR + Electron）
npm run dev
```

### 生产构建

```bash
# 编译并打包（NSIS 安装包 + ZIP 便携版）
npm run dist
```

安装包输出在 `release/` 目录。发布版由 GitHub Actions 自动构建，推送 tag 触发：

```bash
git tag v1.0.0 && git push origin v1.0.0
```

CI 构建完成后安装包自动出现在 [Releases](https://github.com/MZHuangJie/DeepSeek-Agent/releases) 页面。

### 直接从源码运行

```bash
npm run build
npm start
```

## 配置

### 基本配置

首次启动后在聊天面板底部输入 **API Key** 即可开始使用。API Key 通过 Electron `safeStorage` 加密存储。

### 模型管理

点击左侧 Activity Bar 底部 ⚙ 设置图标，或输入框左侧模型选择菜单 → "管理模型"。

**添加模型** — 选择**提供商**，系统自动填入默认 Base URL、模型 ID、上下文窗口：

| 提供商 | API 格式 | 默认模型 | 上下文窗口 |
|--------|----------|----------|-----------|
| OpenAI | OpenAI 兼容 | gpt-4o | 128K |
| Anthropic | **Anthropic 原生 Messages API** | claude-sonnet-4-20250514 | 200K |
| Google Gemini | OpenAI 兼容端点 | gemini-2.5-flash | 1M |
| DeepSeek | OpenAI 兼容 | deepseek-chat | 64K |
| 通义千问 | OpenAI 兼容 | qwen-plus | 128K |
| 智谱 GLM | OpenAI 兼容 | glm-4-plus | 128K |
| Moonshot | OpenAI 兼容 | moonshot-v1-8k | 8K |
| 自定义 | OpenAI 兼容 | 任意 | 可配 |

**Anthropic 原生支持**：选择 Anthropic 提供商后，Agent 直接调用 Anthropic Messages API（`/v1/messages`），无需第三方代理。支持流式 SSE、Thinking、Tool Use 等完整功能。

**每个模型可单独配置 API Key**（密码框，留空则使用全局 Key）。

**多模型切换**：输入框左侧显示当前模型，点击即可切换，切换即时生效。

**上下文窗口**可根据实际模型手动调整，用于 Token 用量预估和上下文自动压缩。

### 生图模型

在模型设置 → "生图模型配置" 中独立配置：

- **API 类型**：`/v1/images/generations`（OpenAI 兼容）或 `/v1/chat/completions`（Gemini 等）
- **Base URL**：图像生成 API 端点
- **模型 ID**：如 `gpt-image-1`、`gemini-3-pro-image-preview`
- **API Key**：生图专用密钥
- **扩展参数（JSON）**：模型特有参数，如 Gemini 的 `{"extra_body":{"google":{"image_config":{"aspect_ratio":"16:9","image_size":"2K"}}}}`
- **Prompt 生成指令**：自定义 LLM 生成生图 Prompt 的系统提示词

支持 HTTP URL 和 base64 两种输出。base64 图片自动存入 `.deepseek-agent-images/`。

### 下载安装包

从 [GitHub Releases](https://github.com/MZHuangJie/DeepSeek-Agent/releases) 下载最新的安装包（`.exe` 安装程序或 `.zip` 便携版）。安装包由 GitHub Actions 自动构建发布。

## 技术栈

- **前端**：React 18 + TypeScript + Zustand
- **编辑器**：Monaco Editor
- **Markdown**：react-markdown + remark-gfm
- **终端**：node-pty + xterm.js
- **桌面框架**：Electron 34
- **构建工具**：Vite 6 + electron-builder
- **本地数据库**：better-sqlite3（会话、插件、设置持久化）
- **服务端数据库**：PostgreSQL（云端同步）

## 项目结构

```
DeepSeek-Agent/
├── src/
│   ├── main/           # Electron 主进程
│   │   ├── agent/      # Agent 核心（工具、提示词、上下文、子代理）
│   │   ├── db/         # 数据库操作
│   │   ├── ipc/        # IPC 处理器
│   │   ├── plugin/     # 插件注册与发现
│   │   ├── security/   # 密钥管理
│   │   └── services/   # 生图、浏览器、网页预览、搜索、Anthropic 客户端
│   ├── preload/        # 预加载脚本
│   └── renderer/       # 渲染进程
│       ├── components/ # React 组件
│       │   ├── account/ # 账户中心、角色广场、收藏夹
│       │   ├── agent/  # Agent 观测面板
│       │   ├── chat/   # 聊天面板
│       │   ├── editor/ # 代码编辑器
│       │   ├── roleplay/# 角色管理
│       │   ├── sidebar/# 侧边栏（文件树、ActivityBar）
│       │   └── settings/# 模型/主题设置
│       ├── stores/     # Zustand 状态管理
│       └── public/     # 静态资源
├── server/             # 云端同步服务端（Express + PostgreSQL）
├── skills/             # 内置技能文件
└── package.json
```

## 服务端部署

云端同步功能需要单独部署服务端。详见 [`deploy/server/`](deploy/server/) 目录。

### 快速部署（Ubuntu）

```bash
# 1. 创建数据库
sudo -u postgres createdb deepseek_agent

# 2. 上传代码并安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 修改 DATABASE_URL 和 JWT_SECRET

# 4. 启动（自动建表）
npm run start:server

# 或使用 PM2 守护
pm2 start ecosystem.config.cjs
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | 必填 |
| `JWT_SECRET` | JWT 签名密钥（≥16位） | 必填 |
| `PORT` | 监听端口 | 8787 |
| `ALLOW_REGISTER` | 是否允许公开注册 | true |
| `NODE_ENV` | 运行环境 | production |

## 许可证

版权所有 (C) 2025 DeepSeek Agent。保留所有权利。

本软件为专有软件，未经明确书面授权，任何人不得以任何形式使用、复制、修改、合并、出版、分发、再许可和/或销售本软件的副本。详细信息请联系项目维护者。
