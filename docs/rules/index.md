# 规则总览

skill-audit 内置 9 条安全规则，覆盖代码安全、依赖安全、编码安全、供应链安全四大维度。

## 规则列表

| Rule ID | 名称 | 维度 | 严重程度 | 描述 |
|---------|------|------|----------|------|
| [`dangerous-commands`](./dangerous-commands.md) | Dangerous Commands | 代码安全 | 🔴/🟡 | 检测 `rm -rf`、`eval()`、`exec()`、`dd`、`mkfs`、`Function()` 等危险命令和动态代码执行 |
| [`secret-leaks`](./secret-leaks.md) | Secret & Credential Leaks | 代码安全 | 🔴/🟡 | 检测硬编码的 API key、token、密码、私钥、数据库连接字符串 |
| [`prompt-injection`](./prompt-injection.md) | Prompt Injection Detection | 代码安全 | 🔴/🟡 | 检测 "ignore previous instructions"、角色覆盖、越狱模式、LLM 特殊 token |
| [`suspicious-network`](./suspicious-network.md) | Suspicious Network Activity | 代码安全 | 🔴/🟡 | 检测 `curl \| bash`、数据外泄、原始 IP 请求、隧道服务 |
| [`permission-audit`](./permission-audit.md) | Permission Audit | 代码安全 | 🟡/🔴 | 审计文件系统、网络、命令执行、环境变量、加密、数据库权限使用 |
| [`dependency-audit`](./dependency-audit.md) | Dependency Audit | 依赖安全 | 🔴/🟡 | 检测 typosquatting、恶意包、未固定版本、自定义 registry |
| [`file-system-audit`](./file-system-audit.md) | File System Audit | 代码安全 | 🔴/🟡 | 检测敏感路径访问、系统目录写入、符号链接攻击、不安全临时文件 |
| [`encoding-audit`](./encoding-audit.md) | Encoding Audit | 编码安全 | 🔴/🟡 | 检测 Unicode bidi 控制字符（Trojan Source）、零宽字符、Base64 混淆 |
| [`supply-chain-audit`](./supply-chain-audit.md) | Supply Chain Audit | 供应链安全 | 🔴/🟡 | 检测 install 生命周期脚本、自定义 registry、Dockerfile 远程获取 |

## 严重程度说明

| 级别 | 标记 | 含义 | 扣分 |
|------|------|------|------|
| danger | 🔴 | 严重安全风险，需立即修复 | -15 分 |
| warn | 🟡 | 潜在安全隐患，建议关注 | -5 分 |

## 子规则数量统计

| 规则 | 子规则数 |
|------|----------|
| dangerous-commands | 15 |
| secret-leaks | 11 |
| prompt-injection | 11 |
| suspicious-network | 10 |
| permission-audit | 6 + manifest 对比 |
| dependency-audit | 10+ |
| file-system-audit | 22+ |
| encoding-audit | 4 |
| supply-chain-audit | 4 |

## 扫描范围

支持的文件类型：

`.js` `.ts` `.py` `.sh` `.bash` `.md` `.txt` `.yaml` `.yml` `.json` `.toml` `.prompt` `.jinja` `.hbs` `.ejs` `Dockerfile`

## 自定义规则

参见 [README — Adding custom rules](../../README.md#adding-custom-rules)。
