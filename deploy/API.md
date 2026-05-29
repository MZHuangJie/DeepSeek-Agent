# DeepSeek Agent 服务端部署文档

API 基路径：`https://your-domain.com/ds/api`（本地：`http://127.0.0.1:8787/ds/api`）

## 1. 环境准备

### PostgreSQL

```bash
# Ubuntu
sudo apt update && sudo apt install postgresql

# 创建数据库
sudo -u postgres psql -c "CREATE DATABASE deepseek_agent;"
# 或
sudo -u postgres createdb deepseek_agent
```

### Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## 2. 部署代码

### 方式 A：从完整项目部署（推荐，已有 clone）

```bash
git clone https://github.com/MZHuangJie/DeepSeek-Agent.git
cd DeepSeek-Agent
npm install
cp .env.example .env
```

### 方式 B：最小化部署（仅服务端）

```bash
cd deploy/server
bash deploy.sh user@your-server /opt/deepseek-agent-server
```

或手动：

```bash
scp deploy/server/server-deploy.tar.gz user@server:/opt/
ssh user@server "mkdir -p /opt/deepseek-agent-server && cd /opt/deepseek-agent-server && tar xzf ../server-deploy.tar.gz && npm install"
```

## 3. 环境变量配置

```bash
cp .env.example .env
nano .env
```

```bash
PORT=8787
NODE_ENV=production

# 必填：PostgreSQL 连接字符串
DATABASE_URL=postgresql://user:password@localhost:5432/deepseek_agent

# 必填：至少 16 位随机字符串
JWT_SECRET=your-random-secret-here

# 可选：关闭公开注册
ALLOW_REGISTER=true
```

## 4. 启动服务

### 开发/测试

```bash
npm run start:server
```

### 生产环境（PM2）

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

`ecosystem.config.cjs` 示例：

```javascript
module.exports = {
  apps: [{
    name: 'deepseek-agent-api',
    script: 'server/index.ts',
    interpreter: 'tsx',
    env: {
      NODE_ENV: 'production',
    },
    env_file: '.env',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
  }],
};
```

### 生产环境（systemd）

```ini
[Unit]
Description=DeepSeek Agent API
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=/opt/deepseek-agent-server
EnvironmentFile=/opt/deepseek-agent-server/.env
ExecStart=/usr/bin/npx tsx server/index.ts
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable deepseek-agent-api
sudo systemctl start deepseek-agent-api
```

## 5. Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /ds/ {
        proxy_pass http://127.0.0.1:8787/ds/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }
}
```

HTTPS（Certbot）：

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 6. API 端点

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/ds/api/health` | 健康检查 |
| POST | `/ds/api/auth/register` | 注册 |
| POST | `/ds/api/auth/login` | 登录 |
| GET | `/ds/api/auth/me` | 当前用户（Bearer） |
| POST | `/ds/api/auth/logout` | 退出（Bearer，客户端清 token 即可） |
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

## 7. 数据库表结构

启动时自动创建以下表：

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(32) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

CREATE TABLE cloud_sessions (
  id VARCHAR(64) NOT NULL,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  payload TEXT NOT NULL,
  message_count INT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE cloud_characters (
  id VARCHAR(64) NOT NULL,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  payload TEXT NOT NULL,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  PRIMARY KEY (user_id, id)
);
```

## 8. 桌面端配置

默认 API：`https://your-domain.com/ds/api`

本地调试：登录面板展开「服务器地址」，填写 `http://127.0.0.1:8787/ds/api`
