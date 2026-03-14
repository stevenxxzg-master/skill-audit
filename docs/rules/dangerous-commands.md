# Dangerous Commands

| 属性 | 值 |
|------|-----|
| Rule ID | `dangerous-commands` |
| 全名 | Dangerous Commands |
| 维度 | 代码安全 |
| 默认严重程度 | 🔴 danger / 🟡 warn |

## 检测什么

扫描代码中的危险系统命令和动态代码执行模式。这些模式可以删除文件、格式化磁盘、执行任意代码，或通过 shell 注入获取系统控制权。

## 为什么危险

AI agent skill 中的代码会被自动执行。如果 skill 包含 `rm -rf /`、`eval()` 或 `dd if=` 等命令，agent 会在没有人工确认的情况下直接运行，可能导致：

- 数据永久丢失（递归删除、磁盘格式化）
- 远程代码执行（eval/exec 注入）
- 权限提升（world-writable 权限）
- 系统破坏（块设备写入）

## 子规则详细说明

### `dangerous-commands/rm-force` — 强制递归删除 🔴

检测 `rm -rf`、`rm -f` 等带 force 标志的删除命令。

```bash
rm -rf /var/log/*
rm -f --no-preserve-root /
```

### `dangerous-commands/rm-recursive` — 递归删除 🔴

检测 `rm -r` 递归删除命令（即使没有 force 标志）。

```bash
rm -r /home/user/data
```

### `dangerous-commands/eval` — eval() 代码注入 🔴

检测 JavaScript/Python 中的 `eval()` 调用，可执行任意字符串为代码。

```js
eval(userInput)
eval('console.log("pwned")')
```

### `dangerous-commands/exec-call` — exec() 命令执行 🟡

检测 `exec()` 调用，可能执行任意 shell 命令。

```js
exec('ls -la ' + userInput)
```

### `dangerous-commands/child-process` — child_process 导入 🟡

检测 Node.js `child_process` 模块的使用，该模块可运行任意系统命令。

```js
import { exec } from 'child_process'
const cp = require('child_process')
```

### `dangerous-commands/subprocess` — Python subprocess 🟡

检测 Python `subprocess` 模块的使用。

```python
import subprocess
subprocess.run(['rm', '-rf', '/'])
```

### `dangerous-commands/os-system` — os.system() 🔴

检测 Python `os.system()` 调用，直接通过 shell 执行命令，极易受注入攻击。

```python
os.system('rm -rf ' + user_path)
```

### `dangerous-commands/chmod-world` — 全局可写权限 🟡

检测设置 world-writable 权限的 chmod 命令（如 `chmod 777`）。

```bash
chmod 777 /var/www/html
chmod 766 config.json
```

### `dangerous-commands/kill-9` — 强制终止进程 🟡

检测 `kill -9`（SIGKILL），不允许进程优雅退出。

```bash
kill -9 $PID
```

### `dangerous-commands/mkfs` — 格式化文件系统 🔴

检测 `mkfs` 命令，可格式化整个磁盘分区。

```bash
mkfs.ext4 /dev/sda1
```

### `dangerous-commands/dd` — 原始磁盘写入 🔴

检测 `dd` 命令的磁盘写入操作，可覆盖整个磁盘。

```bash
dd if=/dev/zero of=/dev/sda bs=1M
```

### `dangerous-commands/dev-write` — 块设备直接写入 🔴

检测直接向 `/dev/sd*` 块设备写入数据。

```bash
echo "data" > /dev/sda
```

### `dangerous-commands/function-constructor` — Function 构造器 🔴

检测 JavaScript `new Function()` 动态代码执行。

```js
const fn = new Function('return ' + userInput)
```

### `dangerous-commands/dunder-import` — Python 动态导入 🟡

检测 Python `__import__()` 动态导入，可加载任意模块。

```python
mod = __import__(user_input)
```

### `dangerous-commands/importlib` — importlib 动态导入 🟡

检测 Python `importlib` 的使用，可动态加载任意模块。

```python
import importlib
mod = importlib.import_module(name)
```

## 真实案例 / 攻击场景

1. **恶意 skill 伪装清理工具**：一个声称"清理临时文件"的 skill，实际执行 `rm -rf ~/` 删除用户所有数据
2. **eval 注入**：skill 从外部 API 获取配置，通过 `eval()` 解析，攻击者篡改 API 返回值注入恶意代码
3. **dd 磁盘覆写**：skill 声称"备份磁盘"，实际用 `dd if=/dev/zero of=/dev/sda` 清空磁盘

## 修复建议

| 子规则 | 建议 |
|--------|------|
| `rm-force` / `rm-recursive` | 使用 `trash-cli` 替代，或添加确认提示 |
| `eval` | 用 `JSON.parse()` 或沙箱解释器替代 |
| `exec-call` | 用 `execFile()` 并显式传参，避免 shell 注入 |
| `child-process` | 确保使用固定命令，不接受用户输入 |
| `subprocess` | 验证所有参数，避免 `shell=True` |
| `os-system` | 用 `subprocess.run()` + 显式参数列表替代 |
| `chmod-world` | 使用 `755` 或 `644` 替代 |
| `kill-9` | 优先使用 `SIGTERM (kill -15)` |
| `mkfs` / `dd` / `dev-write` | 添加明确的确认保护 |
| `function-constructor` | 使用静态代码路径或沙箱求值器 |
| `dunder-import` / `importlib` | 使用显式静态导入，验证模块名 |

## 误报说明

- **测试文件**中的 `eval()` 可能是测试用例的一部分
- **构建脚本**中的 `rm -rf dist/` 是常见的清理操作
- **文档/注释**中提到的命令不会被执行

### 如何忽略

在行尾添加注释标记（规划中）：

```js
// skill-audit-ignore: dangerous-commands/eval
eval(trustedConfig)
```

或在 `.skill-audit-ignore` 文件中配置：

```
dangerous-commands/rm-recursive:build.sh
dangerous-commands/eval:tests/**
```
