# Encoding Audit

| 属性 | 值 |
|------|-----|
| Rule ID | `encoding-audit` |
| 全名 | Encoding Audit |
| 维度 | 编码安全 |
| 默认严重程度 | 🔴 danger / 🟡 warn |

## 检测什么

检测利用 Unicode 特性隐藏恶意内容的攻击手法：双向控制字符（Trojan Source）、零宽字符隐藏内容、Base64 编码的恶意代码。

## 为什么危险

编码攻击的核心在于"看到的不是实际执行的"：

- Bidi 控制字符可以让代码在编辑器中显示为安全的，但实际执行完全不同的逻辑（Trojan Source 攻击）
- 零宽字符可以在变量名中隐藏不可见字符，创建看似相同但实际不同的标识符
- Base64 编码可以隐藏 `eval()`、`exec()` 等危险调用，绕过静态分析

## 子规则详细说明

### `encoding-audit/bidi-control` — Unicode 双向控制字符 🔴

检测以下 Unicode 方向控制字符：

| 字符 | 名称 | Unicode |
|------|------|---------|
| LRE | Left-to-Right Embedding | U+202A |
| RLE | Right-to-Left Embedding | U+202B |
| PDF | Pop Directional Formatting | U+202C |
| LRO | Left-to-Right Override | U+202D |
| RLO | Right-to-Left Override | U+202E |
| LRI | Left-to-Right Isolate | U+2066 |
| RLI | Right-to-Left Isolate | U+2067 |
| FSI | First Strong Isolate | U+2068 |
| PDI | Pop Directional Isolate | U+2069 |
| RLM | Right-to-Left Mark | U+200F |
| LRM | Left-to-Right Mark | U+200E |

这些字符可以改变文本的显示方向，使代码审查者看到与实际执行不同的逻辑。

**Trojan Source 攻击示例**：

```js
// 看起来像：if (isAdmin) { grantAccess(); }
// 实际执行：if (isAdmin‮ ⁦) { denyAccess(); } else { ⁩grantAccess(); }
```

### `encoding-audit/zero-width` — 零宽字符 🟡

检测以下零宽字符：

| 字符 | 名称 | Unicode |
|------|------|---------|
| ZWSP | Zero-width space | U+200B |
| ZWNJ | Zero-width non-joiner | U+200C |
| ZWJ | Zero-width joiner | U+200D |
| BOM | BOM / zero-width no-break space | U+FEFF |

注意：文件开头的 BOM（U+FEFF）会被自动忽略，因为这是合法的 UTF-8 BOM 标记。

**攻击示例**：

```js
// 两个看起来完全相同的变量名，但其中一个包含零宽字符
const admin = true;
const admin‌ = false;  // 包含 U+200C (ZWNJ)
```

### `encoding-audit/suspicious-base64` — 可疑 Base64 编码 🔴

解码 Base64 字符串并检查是否包含以下危险关键词：

- `eval(`、`exec(`、`Function(`
- `child_process`、`require(`、`import(`
- `/bin/sh`、`/bin/bash`
- `curl `、`wget `

仅检测长度 ≥ 40 字符的 Base64 字符串。

```js
// Base64 编码的 eval("malicious code")
const payload = "ZXZhbCgiY29uc29sZS5sb2coJ3B3bmVkJykiKQ=="
```

### `encoding-audit/long-base64` — 超长 Base64 字符串 🟡

检测长度 ≥ 200 字符的 Base64 字符串，可能是混淆的恶意载荷。

## 真实案例 / 攻击场景

1. **Trojan Source**（2021，CVE-2021-42574）：剑桥大学研究者发现，利用 Unicode bidi 控制字符可以让代码在 GitHub、编辑器中显示为安全的，但编译/执行时逻辑完全不同。影响几乎所有编程语言。
2. **零宽字符水印**：攻击者在代码中嵌入零宽字符作为隐蔽通信通道，或创建视觉上相同但行为不同的变量
3. **Base64 混淆后门**：恶意 npm 包将后门代码 Base64 编码后通过 `eval(atob(...))` 执行，绕过代码审查

## 修复建议

| 子规则 | 建议 |
|--------|------|
| `bidi-control` | 移除所有 Unicode 方向控制字符。如果确实需要 RTL 文本，使用 HTML `dir` 属性替代 |
| `zero-width` | 移除零宽字符。使用 `cat -A` 或十六进制编辑器检查不可见字符 |
| `suspicious-base64` | 移除 Base64 编码的可执行代码。使用明文代码替代 |
| `long-base64` | 审查长 Base64 字符串的内容和用途。如果是合法数据（如图片），添加注释说明 |

## 误报说明

- **合法的 Base64 数据**：图片的 data URI、证书、序列化数据等
- **国际化内容**：阿拉伯语、希伯来语等 RTL 语言的文本可能包含合法的 bidi 标记
- **Emoji**：某些 emoji 使用 ZWJ（U+200D）连接（如 👨‍👩‍👧‍👦）
- **BOM**：文件开头的 U+FEFF 是合法的 UTF-8 BOM（已自动忽略）

### 如何忽略

在 `.skill-audit-ignore` 文件中配置：

```
encoding-audit/long-base64:assets/**
encoding-audit/zero-width:locales/**
```
