# Configuration

skill-audit 支持通过配置文件自定义扫描行为。

## 配置文件

按优先级查找：

1. CLI `--config <path>` 指定的路径
2. 扫描目标目录下的 `.skillauditrc.json`
3. 扫描目标目录下的 `skill-audit.config.js`

如果都不存在，使用默认配置。

## .skillauditrc.json

```json
{
  "rules": {
    "dangerous-commands": true,
    "secret-leaks": true,
    "prompt-injection": true,
    "suspicious-network": true,
    "permission-audit": true,
    "dependency-audit": true,
    "file-system-audit": true,
    "encoding-audit": true,
    "supply-chain-audit": true,
    "sandbox-escape": true,
    "config-audit": true
  },
  "severity": {
    "permission-audit": "warn"
  },
  "ignore": [
    "test/**",
    "*.test.js",
    "docs/**"
  ],
  "plugins": "./my-plugins"
}
```

## 字段说明

### `rules`

类型：`Record<string, boolean>`

启用或禁用特定规则。键为规则 ID，值为 `true`（启用）或 `false`（禁用）。

默认所有内置规则启用。

```json
{
  "rules": {
    "encoding-audit": false,
    "supply-chain-audit": false
  }
}
```

### `severity`

类型：`Record<string, "warn" | "danger">`

覆盖规则的默认严重程度。

```json
{
  "severity": {
    "suspicious-network": "warn"
  }
}
```

### `ignore`

类型：`string[]`

Glob 模式列表，匹配的文件将跳过扫描。

```json
{
  "ignore": [
    "test/**",
    "*.test.js",
    "fixtures/**",
    "docs/**"
  ]
}
```

### `plugins`

类型：`string | null`

自定义规则插件目录路径（相对于配置文件所在目录）。

```json
{
  "plugins": "./my-rules"
}
```

目录下的每个 `.js` 文件会被加载为一条自定义规则。详见 [自定义规则开发指南](./custom-rules.md)。

## skill-audit.config.js

支持 JS 配置文件（ESM）：

```js
export default {
  rules: {
    'encoding-audit': false,
  },
  ignore: ['test/**'],
  plugins: './my-rules',
};
```

## 行内忽略

在代码中使用注释忽略下一行的 finding：

```js
// skill-audit-ignore-next-line
eval(userInput); // 这行不会被报告
```

```python
# skill-audit-ignore-next-line
exec(code)  # 这行不会被报告
```

## 环境变量

API 服务支持以下环境变量：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3847` | 服务监听端口 |
| `NODE_ENV` | - | 设为 `production` 启用生产模式 |
| `RATE_LIMIT` | `10` | 每 IP 每分钟最大请求数 |
| `MAX_CONCURRENT` | `3` | 最大并发扫描数 |
