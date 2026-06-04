# Oh My DeepSeek

桌面端 AI 编程助手，**深度适配 DeepSeek 模型**（思考模式、前缀缓存、工具调用），同时兼容 OpenAI、Anthropic、通义千问、智谱等主流模型。集成了代码编写、项目管理、AI 对话、角色扮演、Multi-Agent 协作等功能，基于 Electron + React + TypeScript 构建。

## ✨ 功能特性

### 🤖 AI 对话

- **五种模式** — 编程助手、聊天、角色扮演、计划模式、Multi-Agent 协作
- 流式输出，深度适配 DeepSeek 思考模式，实时展示 `<thinking>` 推理过程
- 工具调用全流程可视化：名称、参数、结果
- 命令系统：`/plan` `/review` `/brainstorming` `/debugging` `/tdd` 等 15+ 命令
- 完整的 Markdown 渲染：代码高亮、表格、图片、GFM
- 粘贴图片到对话，自动调用视觉模型识别描述
- 会话标题自动生成

### 🛠 Agent 工具

- **文件操作** — 读取、写入、精确编辑、搜索代码
- **终端** — 基于 node-pty 的真实终端模拟（PowerShell / cmd / bash），多 Tab
- **子代理** — 大型项目自动拆分任务并行处理，独立上下文互不干扰
- **生图** — 调用多种生图模型生成图片
- **网页预览** — 生成 HTML 页面并实时预览（Hot Reload）
- **网络能力** — 搜索、抓取网页、网页截图
- **视觉理解** — 调用视觉模型描述图片内容
- **Git 集成** — 查看状态/差异、提交、推送等操作

### 📂 文件管理

- 文件树浏览器：创建、重命名、删除
- 右键菜单：添加到对话、新建文件等
- 打开文件/文件夹作为工作区
- 记住上次打开的位置，最近工作区列表

### 📝 代码编辑器

- Monaco Editor，多语言语法高亮
- 图片查看器
- 未保存状态指示

### 🎭 角色扮演

- 创建/编辑/删除角色，支持从模板生成
- AI 生成角色立绘，多种画风可选，支持参考图
- **单人模式** — 沉浸式 1v1 角色对话
- **群像模式** — 多角色同时参与对话
- 自定义角色状态面板（数值/文本/列表字段）

### 👥 Multi-Agent 群聊

- **7 种预设 Agent 角色**：产品经理、UI 设计师、前端工程师、后端工程师、代码审核、测试工程师、游戏策划
- NPC 群聊 — 用户创建的角色参与讨论
- Agent 群聊 — 预设 Agent 角色协作，各司其职
- 导演调度模式：AI 导演自动分配发言顺序，组织有意义的协作讨论
- 每位角色有明确职责边界，互不越界

### 🔐 云同步

- 账户注册/登录
- 角色、模板、对话云端备份与恢复
- 角色广场：浏览、搜索、收藏社区角色
- 可自部署同步服务（见 `deploy/server/`）

### ⚙️ 模型管理

- **深度适配 DeepSeek** — 思考模式（`reasoning_content`）、前缀缓存命中统计、工具调用优化
- 兼容 OpenAI、Anthropic、通义千问、智谱、Gemini 等主流模型
- 多模型切换，自定义 API Key / Base URL
- 生图模型、视觉模型独立配置
- Token 用量实时统计与余额查询

## 🖥 技术栈

| 层 | 技术 |
|---|------|
| 桌面框架 | Electron 34 |
| 前端 | React 18 + TypeScript + Zustand |
| 编辑器 | Monaco Editor |
| 终端 | xterm.js + node-pty |
| 构建 | Vite + electron-builder |
| 数据库 | better-sqlite3（本地）+ PostgreSQL（云端） |
| 云服务 | Express 5 + JWT + bcryptjs |

## 📦 安装

### 下载 Release

从 [Releases](https://github.com/MZHuangJie/Oh-My-DeepSeek/releases) 页面下载：

- **便携版** — `Oh My DeepSeek-x.x.x-win.zip`，解压即用

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/MZHuangJie/Oh-My-DeepSeek.git
cd DeepSeek-Agent

# 安装依赖
npm install

# 开发模式（热重载）
npm run dev

# 构建
npm run build

# 打包
npm run dist
```

## 🚀 使用

### 首次启动

1. 打开软件，点击左侧 **打开文件夹** 选择项目目录
2. 在聊天面板底部 **输入 API Key**
3. 在 ⚙ 设置中 **添加和切换模型**

### 基本操作

| 操作 | 快捷键 |
|------|--------|
| 发送消息 | `Enter` |
| 换行 | `Shift + Enter` |
| 触发命令面板 | `/` |
| 引用文件/成员 | `@` |
| 进入/退出全屏 | `F11` / `Esc` |
| 保存文件 | `Ctrl + S` |

### 群聊

1. 左侧切换到会话面板，点击底部的 **「NPC 群聊」** 或 **「Agent 群聊」**
2. 勾选参与成员（至少 2 人）
3. 创建后在群聊中输入消息，AI 导演自动调度发言

### 云同步（可选）

```bash
# 进入服务端目录
cd deploy/server

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入 PostgreSQL 连接字符串和 JWT_SECRET

# 启动
npm install
npm run start
```

## 📁 项目结构

```
src/
├── main/           # Electron 主进程
│   ├── agent/      # AI Agent 核心（流式调用、工具定义、子代理、提示词）
│   ├── db/         # 本地数据库（SQLite）
│   ├── ipc/        # IPC 通信处理
│   ├── security/   # 安全模块（路径校验、密钥脱敏）
│   └── services/   # 角色扮演存储、日志等
├── preload/        # Electron 预加载脚本
├── renderer/       # 渲染进程（React UI）
│   ├── components/ # UI 组件
│   ├── stores/     # Zustand 状态管理
│   ├── styles/     # 样式文件
│   └── utils/      # 工具函数
├── common/         # 共享类型定义
├── deploy/         # 云同步服务端
├── skills/         # 技能定义（SKILL.md）
└── scripts/        # 构建脚本
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源。

---

**Oh My DeepSeek** — 让 AI 真正融入你的开发工作流 🚀
