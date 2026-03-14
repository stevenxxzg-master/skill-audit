# Secret & Credential Leaks

| 属性 | 值 |
|------|-----|
| Rule ID | `secret-leaks` |
| 全名 | Secret & Credential Leaks |
| 维度 | 代码安全 |
| 默认严重程度 | 🔴 danger / 🟡 warn |

## 检测什么

扫描代码中硬编码的 API 密钥、token、密码、私钥和数据库连接字符串。支持检测 AWS、OpenAI、GitHub、GitLab、Slack 等主流服务的凭证格式。

## 为什么危险

硬编码的凭证一旦随 skill 发布或提交到版本控制：

- 攻击者可直接使用泄露的密钥访问你的云服务、数据库、API
- 密钥轮换成本高，尤其是已被广泛使用的密钥
- 自动化爬虫会持续扫描 GitHub 等平台寻找泄露的密钥
- 一个泄露的 AWS key 可能导致数万美元的账单

## 子规则详细说明

### `secret-leaks/api-key` — 硬编码 API 密钥 🔴

检测 `api_key`、`apikey`、`api-key` 等变量赋值中的长字符串值。

```js
const api_key = "sk_live_abcdef1234567890"
apiKey: "AIzaSyDxxxxxxxxxxxxxxxxxxxxxxx"
```

### `secret-leaks/secret` — 硬编码密码/密钥 🔴

检测 `secret`、`password`、`passwd`、`pwd` 等变量中的硬编码值。

```js
const password = "super_secret_123"
db_passwd = "p@ssw0rd!"
```

### `secret-leaks/token` — 硬编码 Token 🔴

检测 `token` 变量中的长字符串值。

```js
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### `secret-leaks/aws-key` — AWS Access Key ID 🔴

检测 AWS 密钥格式 `AKIA` 开头的 20 字符字符串。

```
AKIAIOSFODNN7EXAMPLE
```

### `secret-leaks/openai-key` — OpenAI API Key 🔴

检测 `sk-` 开头的 OpenAI API 密钥格式。

```
sk-proj-abcdefghijklmnopqrstuvwxyz123456
```

### `secret-leaks/github-token` — GitHub Personal Access Token 🔴

检测 `ghp_` 开头的 GitHub PAT 格式。

```
ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### `secret-leaks/gitlab-token` — GitLab Personal Access Token 🔴

检测 `glpat-` 开头的 GitLab PAT 格式。

```
glpat-xxxxxxxxxxxxxxxxxxxx
```

### `secret-leaks/slack-token` — Slack Token 🔴

检测 `xoxb-`、`xoxp-`、`xoxo-`、`xoxr-`、`xoxs-` 开头的 Slack token。

```
xoxb-1234567890-abcdefghij
```

### `secret-leaks/private-key` — 私钥嵌入 🔴

检测 PEM 格式的私钥头部（RSA、EC、DSA）。

```
-----BEGIN RSA PRIVATE KEY-----
-----BEGIN EC PRIVATE KEY-----
```

### `secret-leaks/db-uri` — 数据库连接字符串 🔴

检测包含凭证的数据库 URI（MongoDB、PostgreSQL、MySQL、Redis）。

```
mongodb://admin:password@host:27017/db
postgres://user:pass@localhost:5432/mydb
```

### `secret-leaks/bearer-token` — Bearer Token 🟡

检测代码中硬编码的 Bearer token（严重程度为 warn，因为可能是示例）。

```
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.xxxxx
```

## 真实案例 / 攻击场景

1. **AWS 密钥泄露**：开发者将 AWS key 硬编码在 skill 中并发布到 npm，自动化爬虫在 3 分钟内发现并用于挖矿，产生 $45,000 账单
2. **OpenAI key 滥用**：skill 中硬编码的 OpenAI key 被提取后用于大量 API 调用，消耗完所有额度
3. **数据库直连**：泄露的 MongoDB URI 导致数据库被勒索软件加密

## 修复建议

| 子规则 | 建议 |
|--------|------|
| `api-key` | 移至环境变量或密钥管理器 |
| `secret` | 使用环境变量或 vault 服务 |
| `token` | 移至环境变量，如已提交立即轮换 |
| `aws-key` | 使用 IAM 角色或 AWS 凭证文件，立即轮换 |
| `openai-key` | 移至 `OPENAI_API_KEY` 环境变量 |
| `github-token` | 撤销并重新生成，使用 `GITHUB_TOKEN` 环境变量 |
| `gitlab-token` | 撤销并改用 CI/CD 变量 |
| `slack-token` | 撤销并使用 OAuth 流程 + 环境变量 |
| `private-key` | 从源码移除，使用文件引用或密钥管理器 |
| `db-uri` | 移至环境变量，避免在代码中包含凭证 |
| `bearer-token` | 运行时从环境变量或认证服务加载 |

## 误报说明

以下情况会被自动跳过：

- `package-lock.json` 和 `yarn.lock` 文件
- 以 `# example`、`// todo`、`// placeholder` 等开头的注释行

其他常见误报：

- 文档中的示例密钥（如 `sk-example...`）
- 测试 fixture 中的假密钥
- Base64 编码的非敏感数据恰好匹配 token 格式

### 如何忽略

在 `.skill-audit-ignore` 文件中配置：

```
secret-leaks/bearer-token:docs/**
secret-leaks/api-key:tests/fixtures/**
```
