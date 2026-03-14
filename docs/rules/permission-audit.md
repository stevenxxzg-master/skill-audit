# Permission Audit

| 属性 | 值 |
|------|-----|
| Rule ID | `permission-audit` |
| 全名 | Permission Audit |
| 维度 | 代码安全 |
| 默认严重程度 | 🟡 warn / 🔴 danger（未声明权限时） |

## 检测什么

分析代码中实际使用的权限（文件系统、网络、命令执行、环境变量、加密、数据库），并与 skill manifest 中声明的权限进行对比。检测未声明的隐藏能力和过度声明的权限。

## 为什么危险

权限审计是 AI agent skill 安全的核心：

- 未声明的权限意味着 skill 在偷偷做用户不知道的事情
- 过度声明的权限违反最小权限原则
- 用户应该在安装前知道 skill 需要哪些权限
- 类似于移动 App 的权限系统，透明度是信任的基础

## 子规则详细说明

### `permission-audit/filesystem` — 文件系统访问 🟡

检测 `readFile`、`writeFile`、`readdir`、`mkdir`、`unlink`、`fs.*`、`open()`、`with open` 等文件操作。

```js
fs.readFileSync('/etc/hosts')
writeFile('output.txt', data)
```

```python
with open('config.json') as f:
    data = f.read()
```

### `permission-audit/network` — 网络访问 🟡

检测 `fetch()`、`http.*`、`https.*`、`requests.*`、`urllib`、`axios`、`curl`、`wget` 等网络操作。

```js
const res = await fetch('https://api.example.com/data')
axios.get('https://service.com/endpoint')
```

### `permission-audit/exec` — 命令执行 🟡

检测 `exec()`、`spawn()`、`child_process`、`subprocess`、`os.system`、`os.popen` 等命令执行。

```js
exec('git status', callback)
spawn('node', ['script.js'])
```

### `permission-audit/env` — 环境变量访问 🟡

检测 `process.env`、`os.environ`、`getenv`、`dotenv` 等环境变量访问。

```js
const apiKey = process.env.API_KEY
require('dotenv').config()
```

### `permission-audit/crypto` — 加密操作 🟡

检测 `crypto.*`、`hashlib`、`hmac`、`bcrypt`、`jwt` 等加密相关操作。

```js
const hash = crypto.createHash('sha256').update(data).digest('hex')
```

### `permission-audit/database` — 数据库访问 🟡

检测 `mongodb`、`postgres`、`mysql`、`redis`、`sqlite`、`sequelize`、`prisma`、`mongoose` 等数据库操作。

```js
import mongoose from 'mongoose'
const client = new MongoClient(uri)
```

### `permission-audit/undeclared-*` — 未声明权限 🔴

当 manifest 存在但未声明实际使用的权限时触发（danger 级别）。

```
actual: network, declared: [filesystem]
→ 使用了网络访问但未在 manifest 中声明
```

### `permission-audit/unused-*` — 过度声明权限 🟡

当 manifest 声明了但代码中未实际使用的权限时触发。

```
declared: database, not detected in code
→ 声明了数据库权限但代码中未使用
```

## 真实案例 / 攻击场景

1. **隐藏数据收集**：skill 声称只需要文件系统权限来读取配置，但实际还使用了网络权限将数据发送到外部服务器
2. **权限蔓延**：skill 声明了所有权限但只使用了其中两个，用户无法判断哪些是真正需要的
3. **环境变量窃取**：skill 未声明 env 权限，但通过 `process.env` 读取所有环境变量（包括密钥）

## 修复建议

| 子规则 | 建议 |
|--------|------|
| `filesystem` | 在 skill manifest 中声明文件系统访问，最小化文件操作 |
| `network` | 在 manifest 中声明网络访问，限制为必要的端点 |
| `exec` | 在 manifest 中声明命令执行权限，使用命令白名单 |
| `env` | 在 manifest 中声明环境变量访问，列出所需变量 |
| `crypto` | 在 manifest 中声明加密操作，记录其用途 |
| `database` | 在 manifest 中声明数据库访问，使用最小权限凭证 |
| `undeclared-*` | 在 manifest 中补充声明实际使用的权限 |
| `unused-*` | 从 manifest 中移除未使用的权限声明 |

## 误报说明

- 仅扫描代码文件（`.js`、`.ts`、`.py`、`.sh`、`.bash`），不扫描文档和配置
- 每种权限类型在每个文件中只报告一次（首次出现）
- 正则匹配可能将变量名中包含关键词的情况误判（如变量名 `fetchConfig`）
- manifest 对比仅在 manifest 存在且声明了权限时才进行

### 如何忽略

在 `.skill-audit-ignore` 文件中配置：

```
permission-audit/crypto:src/utils/hash.js
permission-audit/env:src/config.js
```
