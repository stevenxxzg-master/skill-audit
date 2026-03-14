# File System Audit

| 属性 | 值 |
|------|-----|
| Rule ID | `file-system-audit` |
| 全名 | File System Audit |
| 维度 | 代码安全 |
| 默认严重程度 | 🔴 danger / 🟡 warn |

## 检测什么

扫描代码中对敏感路径的访问、系统目录的写入、符号链接攻击和不安全的临时文件使用。

## 为什么危险

文件系统操作是 skill 获取敏感信息和破坏系统的主要途径：

- 读取 `/etc/shadow`、`~/.ssh/` 可窃取凭证和密钥
- 写入 `/usr/bin/`、`/etc/` 可植入后门或修改系统配置
- 符号链接攻击可绕过路径检查，访问受限文件
- 不安全的临时文件使用存在 TOCTOU（Time-of-check to time-of-use）竞态条件

## 子规则详细说明

### 敏感路径读取

#### `file-system-audit/read-etc-passwd` — 读取 /etc/passwd 🟡

```bash
cat /etc/passwd
```

#### `file-system-audit/read-etc-shadow` — 读取 /etc/shadow 🔴

密码哈希文件，可用于离线破解。

```python
open('/etc/shadow').read()
```

#### `file-system-audit/read-master-passwd` — 读取 BSD 密码文件 🔴

```bash
cat /etc/master.passwd
```

#### `file-system-audit/read-ssh` — 访问 SSH 密钥和配置 🟡

检测对 `~/.ssh/`、`.ssh/id_*`、`.ssh/authorized_keys`、`.ssh/known_hosts` 的访问。

```js
readFileSync(path.join(homedir, '.ssh/id_rsa'))
```

#### `file-system-audit/read-aws` — 访问 AWS 凭证 🟡

检测对 `~/.aws/credentials`、`~/.aws/config` 的访问。

#### `file-system-audit/read-gnupg` — 访问 GPG 密钥 🟡

检测对 `~/.gnupg/` 的访问。

#### `file-system-audit/read-kube` — 访问 Kubernetes 配置 🟡

检测对 `~/.kube/config` 的访问。

#### `file-system-audit/read-sudoers` — 读取 sudoers 🟡

```bash
cat /etc/sudoers
```

#### `file-system-audit/read-dotenv` — 访问 .env 文件 🟡

```js
readFileSync('.env')
```

#### `file-system-audit/read-netrc` — 访问 .netrc 🟡

存储的网络凭证文件。

#### `file-system-audit/read-docker-creds` — 访问 Docker 凭证 🟡

检测对 `~/.docker/config.json` 的访问，可能包含 registry 凭证。

### 系统目录写入

#### `file-system-audit/write-usr` / `writefile-usr` / `open-usr` — 写入 /usr/ 🔴

#### `file-system-audit/write-bin` / `writefile-bin` / `open-bin` — 写入 /bin/ 🔴

#### `file-system-audit/write-sbin` — 写入 /sbin/ 🔴

#### `file-system-audit/write-etc` / `writefile-etc` / `open-etc` — 写入 /etc/ 🔴

所有系统目录写入都是 danger 级别，可能植入后门或修改系统配置。

### 符号链接攻击

#### `file-system-audit/symlink-create` — Node.js symlink 创建 🟡

#### `file-system-audit/py-symlink` — Python symlink 创建 🟡

#### `file-system-audit/ln-symlink` — ln -s 命令 🟡

#### `file-system-audit/readlink` — 符号链接解析 🟡

注意 TOCTOU 竞态条件。

#### `file-system-audit/lstat-check` — lstat 检查 🟡

验证符号链接处理是否安全。

### 不安全临时文件

#### `file-system-audit/hardcoded-tmp` — 硬编码 /tmp/ 路径 🟡

可预测的临时文件名，存在竞态条件风险。

```js
writeFileSync('/tmp/myapp-data.txt', data)
```

#### `file-system-audit/hardcoded-var-tmp` — 硬编码 /var/tmp/ 路径 🟡

#### `file-system-audit/tmpnam` / `tempnam` — 不安全临时文件创建 🟡

C 语言的 `tmpnam()` / `tempnam()` 存在 TOCTOU 竞态。

#### `file-system-audit/mktemp-file` — mktemp 使用 🟡

不带 `-d` 的 mktemp，需验证安全使用。

#### `file-system-audit/open-tmp` / `writefile-tmp` — 直接操作 /tmp/ 🟡

应使用 `mkstemp` 或 `tempfile` 模块替代。

## 真实案例 / 攻击场景

1. **SSH 密钥窃取**：恶意 skill 读取 `~/.ssh/id_rsa` 并通过网络发送给攻击者，获取服务器访问权
2. **后门植入**：skill 向 `/usr/local/bin/` 写入恶意脚本，伪装为常用命令（PATH 劫持）
3. **符号链接攻击**：skill 在 `/tmp/` 创建指向 `/etc/passwd` 的符号链接，然后通过"临时文件"读取系统密码
4. **TOCTOU 竞态**：skill 检查临时文件不存在后创建，攻击者在检查和创建之间替换为符号链接

## 修复建议

| 类别 | 建议 |
|------|------|
| 敏感路径读取 | 移除对敏感系统文件的直接访问，使用 API 或配置文件替代 |
| 系统目录写入 | 不要写入系统目录，使用用户空间目录 |
| 符号链接 | 使用 `O_NOFOLLOW` 标志，检查 `lstat` 后立即操作 |
| 临时文件 | 使用 `mkstemp()`（C）、`tempfile.NamedTemporaryFile()`（Python）、`os.tmpdir()`（Node.js） |

## 误报说明

- **配置管理工具**（如 Ansible、Chef）合法地需要访问系统路径
- **SSH 工具**合法地需要读取 SSH 配置
- **Docker 工具**合法地需要访问 Docker 配置
- 文档中提到的路径不会被执行

### 如何忽略

在 `.skill-audit-ignore` 文件中配置：

```
file-system-audit/read-ssh:src/ssh-manager.js
file-system-audit/hardcoded-tmp:scripts/**
```
