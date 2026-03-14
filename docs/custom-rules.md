# Custom Rules

skill-audit 支持通过插件机制加载自定义规则。

## 规则格式

每条规则是一个 JS 模块，导出一个包含 `id`、`name` 和 `scan` 方法的对象：

```js
export default {
  id: 'my-rule',           // 唯一标识符
  name: 'My Custom Rule',  // 人类可读名称
  scan(content, file, ctx) {
    const findings = [];
    // ... 检测逻辑
    return findings;
  },
};
```

## scan 函数签名

```ts
scan(content: string, file: FileInfo, ctx?: ScanContext): Finding[]
```

### 参数

**`content`** — 文件的完整文本内容。

**`file`** — 文件信息对象：

```ts
{
  path: string;  // 绝对路径
  rel: string;   // 相对于扫描目标的路径
  ext: string;   // 文件扩展名（如 ".js"）
}
```

**`ctx`**（可选）— 扫描上下文：

```ts
{
  manifest?: {
    format: string;
    name: string;
    description: string;
    declaredPermissions: string[];
  } | null;
}
```

### 返回值

返回 `Finding[]` 数组，每个 finding 包含：

```ts
{
  rule: string;      // 规则标识（建议格式：rule-id/sub-type）
  severity: 'danger' | 'warn';
  file: string;      // 使用 file.rel
  line: number;      // 1-based 行号
  msg: string;       // 问题描述
  snippet: string;   // 代码片段（max 120 chars）
  fix?: string;      // 修复建议（可选）
}
```

## 注册方式

### 方式一：插件目录

将规则文件放在一个目录中，通过 `--plugins` 参数或配置文件指定：

```bash
skill-audit ./my-skill --plugins ./my-rules
```

```json
// .skillauditrc.json
{
  "plugins": "./my-rules"
}
```

目录下所有 `.js` 文件会被自动加载。每个文件必须导出一个有效的规则对象（包含 `id`、`name`、`scan`）。

### 方式二：编程使用

直接导入 `loadPlugins` 加载插件目录：

```js
import { loadPlugins } from 'skill-audit/src/plugin-loader.js';

const customRules = await loadPlugins('./my-rules');
```

## 完整示例

### 检测硬编码 IP 地址

```js
const IP_PATTERN = /\b(\d{1,3}\.){3}\d{1,3}\b/g;
const SAFE_IPS = new Set(['0.0.0.0', '127.0.0.1', '255.255.255.255']);

export default {
  id: 'hardcoded-ip',
  name: 'Hardcoded IP Address',
  scan(content, file) {
    const findings = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match;
      while ((match = IP_PATTERN.exec(line)) !== null) {
        if (!SAFE_IPS.has(match[0])) {
          findings.push({
            rule: 'hardcoded-ip/detected',
            severity: 'warn',
            file: file.rel,
            line: i + 1,
            msg: `Hardcoded IP address: ${match[0]}`,
            snippet: line.trim().slice(0, 120),
            fix: 'Use environment variables or configuration files for IP addresses.',
          });
        }
      }
    }

    return findings;
  },
};
```

### 检测不安全的正则表达式

```js
// 检测可能导致 ReDoS 的正则模式
const REDOS_PATTERNS = [
  /\(\.\*\)\+/,
  /\(\.\+\)\+/,
  /\([^)]*\|[^)]*\)\+/,
];

export default {
  id: 'unsafe-regex',
  name: 'Unsafe Regular Expression',
  scan(content, file) {
    if (file.ext !== '.js' && file.ext !== '.ts') return [];

    const findings = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of REDOS_PATTERNS) {
        if (pattern.test(line)) {
          findings.push({
            rule: 'unsafe-regex/redos',
            severity: 'warn',
            file: file.rel,
            line: i + 1,
            msg: 'Potentially unsafe regex (ReDoS risk)',
            snippet: line.trim().slice(0, 120),
            fix: 'Simplify the regex or add input length limits.',
          });
          break;
        }
      }
    }

    return findings;
  },
};
```

## 验证

插件加载时会验证：

- `id` — 必须是非空字符串
- `name` — 必须是非空字符串
- `scan` — 必须是函数

不满足条件的插件会被跳过并输出警告。

## 更多示例

参见 [`examples/`](../examples/) 目录：

- [`custom-rule.js`](../examples/custom-rule.js) — 检测安全相关的 TODO/FIXME
- [`regex-rule.js`](../examples/regex-rule.js) — 基于正则的自定义规则
- [`async-rule.js`](../examples/async-rule.js) — 异步规则示例
