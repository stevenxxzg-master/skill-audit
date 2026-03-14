# Getting Started

5 分钟快速开始 skill-audit。

## 安装

```bash
# 直接使用（无需安装）
npx skill-audit ./my-skill

# 全局安装
npm install -g skill-audit

# 项目内安装
npm install --save-dev skill-audit
```

## 第一次扫描

```bash
# 扫描一个 skill 目录
skill-audit ./path/to/skill
```

输出示例：

```
  skill-audit  ./my-skill
  Scanned 5 files

  index.js
    ✗ L19 Forced recursive delete detected
      exec('rm -rf /tmp/*');
      💡 Avoid forced recursive deletes. Use trash-cli or add confirmation prompts.
    ⚠ L1 child_process import — can run arbitrary commands
      💡 Ensure child_process calls use fixed commands, not user-controlled input.

  Summary: 1 danger  1 warning

  Security Score
  █████████████████░░░  80/100  Grade: B
  Deductions: 1 danger (-15)  1 warn (-5)
```

## 输出格式

```bash
# 默认终端输出（彩色）
skill-audit ./my-skill

# JSON 输出（适合 CI/CD）
skill-audit ./my-skill --json

# HTML 报告（可视化）
skill-audit ./my-skill --html

# 中文修复建议
skill-audit ./my-skill --lang zh
```

## 理解报告

### 严重程度

| 图标 | 级别 | 含义 |
|------|------|------|
| ✗ | `danger` | 严重安全风险，必须修复 |
| ⚠ | `warn` | 潜在风险，建议关注 |

### 安全评分

每次扫描生成 0-100 分的安全评分：

- 每个 `danger` 扣 15 分
- 每个 `warn` 扣 5 分
- 满分 100，最低 0

### 等级

| 等级 | 分数 | 含义 |
|------|------|------|
| A | 90-100 | 优秀 |
| B | 70-89 | 良好 |
| C | 50-69 | 一般 |
| D | 30-49 | 较差 |
| F | 0-29 | 危险 |

### 退出码

| 码 | 含义 |
|----|------|
| `0` | 无 danger 级别发现 |
| `1` | 存在 danger 级别发现 |
| `2` | 错误（路径无效、目录为空等） |

## 下一步

- [配置文件](./configuration.md) — 自定义扫描行为
- [自定义规则](./custom-rules.md) — 编写自己的检测规则
- [部署指南](./deployment.md) — Docker 部署 API 服务
