# Deployment

skill-audit API 服务的部署指南。

## Docker

### 构建镜像

```bash
docker build -t skill-audit .
```

### 运行容器

```bash
docker run -d \
  --name skill-audit \
  -p 3847:3847 \
  -e NODE_ENV=production \
  --read-only \
  --tmpfs /tmp \
  --security-opt no-new-privileges:true \
  skill-audit
```

### Dockerfile 说明

项目使用多阶段构建，运行时镜像基于 `node:22-alpine`：

- 零外部 npm 依赖，镜像体积小
- 以非 root 用户 `appuser` 运行
- 内置健康检查（每 30s 检查 `/api/health`）
- 需要 `git` 和 `unzip`（用于 URL 扫描和 ZIP 解压）

## docker-compose

```yaml
services:
  skill-audit:
    build: .
    ports:
      - "3847:3847"
    environment:
      - NODE_ENV=production
      - PORT=3847
    restart: unless-stopped
    read_only: true
    tmpfs:
      - /tmp
    security_opt:
      - no-new-privileges:true
```

```bash
# 启动
docker compose up -d

# 查看日志
docker compose logs -f skill-audit

# 停止
docker compose down
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3847` | 服务监听端口 |
| `NODE_ENV` | - | 设为 `production` 启用生产模式 |
| `RATE_LIMIT` | `10` | 每 IP 每分钟最大请求数 |
| `MAX_CONCURRENT` | `3` | 最大并发扫描数 |

## 反向代理

### Nginx

```nginx
server {
    listen 80;
    server_name audit.example.com;

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:3847;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

### Caddy

```
audit.example.com {
    reverse_proxy localhost:3847
}
```

## 健康检查

```bash
curl http://localhost:3847/api/health
# {"status":"ok","version":"0.9.0","uptime":3600.5}
```

Docker 内置健康检查每 30 秒自动执行。

## 安全建议

- 使用 `--read-only` 文件系统 + `tmpfs /tmp`
- 启用 `no-new-privileges` 安全选项
- 通过反向代理添加 TLS
- 配置防火墙限制访问来源
- 生产环境建议设置更严格的速率限制
