# DeepSeek Agent

基于 Electron + React + TypeScript 构建的桌面端 AI 编程助手，集成 DeepSeek 大模型，提供代码编写、项目管理、AI 对话等一站式开发体验。

## 功能介绍

### AI 对话
- 支持 **编程助手**、**聊天**、**角色扮演** 三种模式
- 流式输出，实时显示思考过程（Thinking Chain）和工具调用
- 多轮工具调用自动分解为独立消息气泡
- 引用文件 Chip 系统，拖拽或右键添加文件到对话上下文
- 命令系统：`/plan`、`/review`、`/coding`、`/brainstorming`、`/debugging`、`/tdd`、`/image`、`/browse` 等
- 消息操作：复制、重新发送、添加到对话

### Agent 工具
- **文件操作**：读取、写入、编辑、删除、列出目录、搜索代码（grep/glob）
- **终端执行**：内置终端，支持多实例、多 Shell（PowerShell/cmd/bash）
- **子代理**：大型项目自动拆分任务并行探索
- **生图**：调用 GPT-Image-2 等生图模型，支持 base64 和 URL 两种输出
- **网页交互**：`present_web` 工具启动本地 HTTP 服务，生成交互式 HTML 页面
- **网络搜索**：DuckDuckGo 搜索
- **网页抓取**：Electron 内嵌 Chromium 抓取网页文本内容
- **网页截图**：对指定 URL 截图并保存到项目目录

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
- 右侧 Agent 观测面板：工具调用时间线、探索进度、Token 用量统计

### 终端
- 基于 node-pty 的真实终端模拟
- 支持多终端实例，Tab 切换
- 切换工作区自动 cd 到新目录

### 插件系统
- GitHub 仓库作为插件源，git clone 浅克隆获取技能文件
- 插件管理器 UI，支持发现、安装、卸载
- 内置 6 个技能文件（plan/code-review/brainstorming/debugging/tdd/coding）

### 其他
- 模型设置：支持多模型切换，自定义 API Key/Base URL
- 生图模型配置：独立的 API 端点、模型选择
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
git clone https://github.com/MZHuangJie/MyCLI.git
cd MyCLI

# 安装依赖
npm install

# 启动开发模式（Vite HMR + Electron）
npm run dev
```

### 生产构建

```bash
# 编译并打包为安装程序
npm run dist
```

安装包输出在 `release/` 目录。

### 直接从源码运行

```bash
npm run build
npm start
```

## 配置

首次启动后在聊天面板底部输入 DeepSeek API Key。
可以在模型设置中添加自定义模型，支持 OpenAI 兼容 API。

生图功能需要在模型设置中单独配置生图 API（支持 OpenAI 兼容的图像生成接口）。

## 技术栈

- **前端**：React 18 + TypeScript + Zustand
- **编辑器**：Monaco Editor
- **终端**：node-pty + xterm.js
- **桌面框架**：Electron 34
- **构建工具**：Vite 6 + electron-builder
- **数据库**：better-sqlite3（会话、插件、设置持久化）

## 项目结构

```
MyCLI/
├── src/
│   ├── main/           # Electron 主进程
│   │   ├── agent/      # Agent 核心（工具、提示词、上下文、子代理）
│   │   ├── db/         # 数据库操作
│   │   ├── ipc/        # IPC 处理器
│   │   ├── plugin/     # 插件注册与发现
│   │   ├── security/   # 密钥管理
│   │   └── services/   # 生图、浏览器、网页预览、搜索等服务
│   ├── preload/        # 预加载脚本
│   └── renderer/       # 渲染进程
│       ├── components/ # React 组件
│       │   ├── agent/  # Agent 观测面板
│       │   ├── chat/   # 聊天面板
│       │   ├── editor/ # 代码编辑器
│       │   ├── sidebar/# 侧边栏（文件树、ActivityBar）
│       │   └── ...
│       ├── stores/     # Zustand 状态管理
│       └── public/     # 静态资源
├── skills/             # 内置技能文件
└── package.json
```

## License

ISC
