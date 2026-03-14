# Dependency Audit

| 属性 | 值 |
|------|-----|
| Rule ID | `dependency-audit` |
| 全名 | Dependency Audit |
| 维度 | 依赖安全 |
| 默认严重程度 | 🔴 danger / 🟡 warn |

## 检测什么

扫描依赖文件中的安全风险：已知恶意包、typosquatting（拼写仿冒）、未固定版本、非标准 registry。支持 npm（package.json）、pip（requirements.txt）和 pyproject.toml。

## 为什么危险

依赖是现代软件最大的攻击面之一：

- Typosquatting 攻击通过相似包名诱导安装恶意包
- 未固定版本可能在更新时引入被投毒的新版本
- 非标准 registry 可能是 dependency confusion 攻击的入口
- 已知恶意包（如 event-stream、ua-parser-js）曾影响数百万项目

## 子规则详细说明

### `dependency-audit/malicious-package` — 已知恶意包 🔴

检测已知的恶意 npm/Python 包名。

已知恶意包列表：
- `crossenv`（typosquat of cross-env，窃取环境变量）
- `event-stream`（被注入恶意代码窃取比特币钱包）
- `flatmap-stream`（event-stream 的恶意依赖）
- `ua-parser-js`（被劫持注入挖矿和密码窃取代码）
- `coa`（被劫持注入恶意代码）
- `rc`（被劫持）
- `colors.js`（作者故意投毒）
- `node-ipc`（作者注入反战抗议代码，破坏用户文件）

### `dependency-audit/typosquat` — npm 拼写仿冒 🔴

检测常见包的拼写变体，可能是 typosquatting 攻击。

覆盖的包：lodash、express、request、axios、react、numpy、pandas、django、flask、cryptography、colors、chalk。

```json
"lodahs": "^1.0.0"    // lodash 的拼写错误
"axois": "^0.21.0"    // axios 的拼写错误
"expresss": "^4.0.0"  // express 的拼写错误
```

### `dependency-audit/suspicious-python` — 可疑 Python 包 🔴

检测 Python 生态中已知的 typosquatting 包。

```
python3-dateutil    // python-dateutil 的仿冒
jeIlyfish           // jellyfish 的仿冒（I 替换 l）
coloramma           // colorama 的仿冒
urllib-3            // urllib3 的仿冒
```

### `dependency-audit/npm-custom-registry` — 非标准 npm Registry 🟡

检测配置了非 `registry.npmjs.org` 或 `registry.yarnpkg.com` 的 registry。

```
registry = https://evil-registry.com/
```

### `dependency-audit/pip-custom-index` — 非标准 PyPI Index 🟡

检测 `--index-url` 指向非官方 PyPI 的配置。

```
--index-url https://evil-pypi.com/simple/
```

### `dependency-audit/pip-extra-index` — 额外 PyPI Index 🟡

检测 `--extra-index-url`，这是 dependency confusion 攻击的常见入口。

```
--extra-index-url https://internal.company.com/pypi/
```

### `dependency-audit/unpinned-npm` — 未固定 npm 版本 🟡

检测 `*`、`latest`、`>=` 等未固定的 npm 依赖版本。

```json
"lodash": "*"
"express": "latest"
"axios": ">=0.21.0"
```

### `dependency-audit/unpinned-pip` — 未固定 pip 版本 🟡

检测 requirements.txt 中完全没有版本约束的依赖。

```
requests
flask
numpy
```

### `dependency-audit/loosely-pinned-pip` — 宽松固定 pip 版本 🟡

检测 `>=` 但没有上限的版本约束。

```
requests>=2.28.0
flask>=2.0
```

### `dependency-audit/unpinned-pyproject` — 未固定 pyproject.toml 版本 🟡

检测 pyproject.toml 中未指定版本的依赖。

## 真实案例 / 攻击场景

1. **event-stream 事件**（2018）：攻击者获取 event-stream 维护权后注入 flatmap-stream，窃取 Copay 比特币钱包私钥，影响数百万下载
2. **ua-parser-js 劫持**（2021）：npm 账号被盗，恶意版本包含加密货币挖矿和密码窃取代码
3. **Dependency Confusion**（2021）：Alex Birsan 通过在公共 registry 发布与内部包同名的包，成功入侵 Apple、Microsoft、PayPal 等公司
4. **colors.js 投毒**（2022）：作者故意在新版本中加入无限循环，影响数千个依赖项目

## 修复建议

| 子规则 | 建议 |
|--------|------|
| `malicious-package` | 立即移除已知恶意包 |
| `typosquat` | 检查包名拼写，使用正确的包名 |
| `suspicious-python` | 验证 Python 包名，使用官方包 |
| `npm-custom-registry` | 验证 registry URL 的合法性 |
| `pip-custom-index` | 验证 PyPI index 的合法性 |
| `pip-extra-index` | 移除不必要的 extra index，使用 `--index-url` 替代 |
| `unpinned-*` | 固定到确切版本号 |
| `loosely-pinned-pip` | 添加版本上限（如 `>=2.28.0,<3.0`） |

## 误报说明

- 包名中包含已知恶意包名的子串可能误报
- 内部 registry 是合法的企业配置
- 开发阶段使用 `latest` 版本是常见做法（但不应出现在发布的 skill 中）

### 如何忽略

在 `.skill-audit-ignore` 文件中配置：

```
dependency-audit/npm-custom-registry:.npmrc
dependency-audit/unpinned-npm:package.json
```
