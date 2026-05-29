#!/bin/bash
# DeepSeek Agent 服务端部署脚本（PostgreSQL 版）
# 用法: ./deploy.sh [user@host] [/remote/path]

set -e

HOST=${1:-}
REMOTE_PATH=${2:-~/deepseek-agent-server}
LOCAL_SERVER_DIR="../../server"

echo "=== 打包服务端代码 ==="
rm -rf .tmp-deploy
mkdir -p .tmp-deploy/server

# 复制服务端代码
cp -r $LOCAL_SERVER_DIR/* .tmp-deploy/server/
cp package.json .tmp-deploy/
cp .env.example .tmp-deploy/.env

cat > .tmp-deploy/README.md << 'EOF'
# DeepSeek Agent Server

依赖: **PostgreSQL**

## 部署步骤

```bash
# 1. 确保 PostgreSQL 已安装并创建数据库
sudo -u postgres psql -c "CREATE DATABASE deepseek_agent;"
# 或
createdb deepseek_agent

# 2. 上传代码到服务器
scp -r . user@host:/opt/deepseek-agent-server

# 3. SSH 登录服务器
ssh user@host
cd /opt/deepseek-agent-server

# 4. 安装依赖
npm install

# 5. 配置环境变量
cp .env.example .env
nano .env
# 修改 DATABASE_URL（必填）
# 修改 JWT_SECRET（至少16位随机字符串）
# 如需关闭注册：ALLOW_REGISTER=false

# 6. 启动（开发/测试）
npm run dev

# 7. 生产环境用 PM2 守护
npm install -g pm2
pm2 start "npm run start" --name deepseek-agent-api
pm2 save
pm2 startup
```

## 目录结构

```
server/
├── index.ts          # 入口
├── db.ts             # PostgreSQL 连接 + 表初始化
├── middleware/
│   └── requireAuth.ts # JWT 认证
└── routes/
    ├── auth.ts       # 注册/登录/修改密码
    └── sync.ts       # 会话/角色云端同步
```

## API 地址

- 基础路径: `http://服务器IP:8787/ds/api`
- 健康检查: `GET /ds/api/health`

## 数据库

启动时会自动创建以下表：

```sql
users              -- 用户账号
cloud_sessions     -- 云端会话备份
cloud_characters   -- 云端角色备份
```

所有表都通过外键关联，删除用户时自动清理其云端数据。

## 环境变量

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串（必填） |
| `JWT_SECRET` | JWT 签名密钥（至少16位） |
| `ALLOW_REGISTER` | `true`/`false` 是否允许注册 |
| `PORT` | 监听端口，默认 8787 |
EOF

tar czf server-deploy.tar.gz -C .tmp-deploy .
rm -rf .tmp-deploy

echo ""
echo "✅ 打包完成: server-deploy.tar.gz"
echo ""

if [ -n "$HOST" ]; then
  echo "=== 上传到服务器 ==="
  scp server-deploy.tar.gz $HOST:$REMOTE_PATH/server-deploy.tar.gz
  ssh $HOST "cd $REMOTE_PATH && tar xzf server-deploy.tar.gz && npm install && rm server-deploy.tar.gz"
  echo ""
  echo "✅ 部署完成"
  echo ""
  echo "下一步:"
  echo "  ssh $HOST"
  echo "  cd $REMOTE_PATH"
  echo "  cp .env.example .env && nano .env"
  echo "  npm run start"
else
  echo "手动上传到服务器:"
  echo "  scp server-deploy.tar.gz user@your-server:/opt/"
  echo ""
  echo "然后在服务器上:"
  echo "  mkdir -p /opt/deepseek-agent-server && cd /opt/deepseek-agent-server"
  echo "  tar xzf ~/server-deploy.tar.gz"
  echo "  npm install"
  echo "  cp .env.example .env && nano .env"
  echo "  npm run start"
fi
