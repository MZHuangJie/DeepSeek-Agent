# DeepSeek Agent 认证 API 部署

API 基路径：`https://dominusgame.top/ds/api`（本地：`http://127.0.0.1:8787/ds/api`）

## 1. 服务器准备

```bash
git clone <repo> && cd MyCLI
npm install
cp .env.example .env
# 编辑 .env：JWT_SECRET 改为随机长字符串，NODE_ENV=production
```

## 2. 启动服务

```bash
npm run start:server
```

默认监听 `8787`。用户数据写入 `server/data/users.json`（或 `WEB_DATA_DIR` 指定目录）。

## 3. Nginx 反向代理

```nginx
location /ds/ {
    proxy_pass http://127.0.0.1:8787/ds/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## 4. systemd 示例

```ini
[Unit]
Description=DeepSeek Agent Auth API
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/MyCLI
EnvironmentFile=/path/to/MyCLI/.env
ExecStart=/usr/bin/npm run start:server
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

## 5. API 端点

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/ds/api/health` | 健康检查 |
| POST | `/ds/api/auth/register` | 注册 |
| POST | `/ds/api/auth/login` | 登录 |
| GET | `/ds/api/auth/me` | 当前用户（Bearer） |
| POST | `/ds/api/auth/logout` | 退出（Bearer，MVP 客户端清 token 即可） |
| POST | `/ds/api/auth/update-profile` | 更新用户名（Bearer） |

### 云端会话同步

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/ds/api/sync/sessions` | 列出云端会话摘要（Bearer） |
| GET | `/ds/api/sync/sessions/:id` | 获取完整会话 payload（Bearer） |
| PUT | `/ds/api/sync/sessions/:id` | 上传/覆盖会话（Bearer，上限 5MB） |
| DELETE | `/ds/api/sync/sessions/:id` | 删除云端会话（Bearer） |

### 云端角色同步

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/ds/api/sync/characters` | 列出云端角色摘要（Bearer） |
| GET | `/ds/api/sync/characters/:id` | 获取完整角色 payload（Bearer） |
| PUT | `/ds/api/sync/characters/:id` | 上传/覆盖角色（Bearer，上限 5MB） |
| DELETE | `/ds/api/sync/characters/:id` | 删除云端角色（Bearer） |

## 6. 桌面端配置

默认 API：`https://dominusgame.top/ds/api`  
本地调试：登录面板展开「服务器地址」，填写 `http://127.0.0.1:8787/ds/api`
