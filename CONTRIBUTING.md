# Contributing to skill-audit

感谢你有兴趣参与贡献！

## 开发流程

1. Fork 并 clone 仓库
2. 创建功能分支：`git checkout -b feat/my-feature`
3. 确保测试通过：`npm test`
4. 提交 PR 到 `main` 分支

## 添加新规则

规则文件放在 `src/rules/` 下，需要导出一个对象：

```js
export const myRule = {
  id: 'my-rule',
  scan(content, file) {
    const findings = [];
    // 逐行扫描，发现问题 push 到 findings
    // { rule: 'my-rule', severity: 'danger'|'warn', file: file.rel, line, message, snippet }
    return findings;
  }
};
```

然后在 `src/index.js` 的 `rules` 数组中注册。

## 代码风格

- ESM（`import`/`export`）
- 无外部依赖（zero-dependency）
- 测试用 Node.js 内置 `node:test`

## 报告问题

直接开 Issue，附上复现步骤即可。
