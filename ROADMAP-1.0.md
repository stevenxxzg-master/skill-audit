# skill-audit v1.0.0 Roadmap

## 当前状态
- 版本: 0.5.0 (package.json 写的 0.4.0 需修正)
- 代码: 5237 行 JS, 41 个文件
- 测试: 246 个, 全过
- 规则: 9 条
- 零外部依赖

## 五步到 1.0.0

### Step 1: 核心功能补全 (v0.6.0)
目标：补齐 1.0 必须有的功能缺口

任务：
1. **沙箱执行检测** — 新规则 src/rules/sandbox-escape.js
   - 检测容器逃逸模式 (mount /proc, /sys, --privileged)
   - 检测 capability 提升 (CAP_SYS_ADMIN, --cap-add)
   - 检测 namespace 操作 (unshare, nsenter)
2. **配置验证** — src/rules/config-audit.js
   - 检测不安全的 YAML/JSON 配置 (debug: true, verbose logging with secrets)
   - 检测 CORS * 配置
   - 检测 TLS/SSL 禁用
3. **CLI 改进**
   - 修复 package.json 版本号 (0.4.0 → 0.6.0)
   - 添加 --verbose 模式显示每个规则的扫描详情
   - 添加 --quiet 模式只输出分数和等级
   - 添加 --exit-zero 忽略 danger 的 exit code
4. **测试覆盖** — 新规则的完整测试

### Step 2: 可靠性 + 边界处理 (v0.7.0)
目标：处理所有边界情况，确保生产可靠

任务：
1. **错误处理加固**
   - 所有 async 函数添加 try-catch 和有意义的错误消息
   - server.js 请求超时处理 (30s)
   - 大文件/大目录的内存保护 (文件数上限 1000, 总大小上限 50MB)
   - 符号链接循环检测
2. **输入验证**
   - CLI 参数验证 (无效参数给出提示而非静默忽略)
   - server.js 输入 sanitization (路径遍历防护)
   - URL 验证加强 (禁止 file://, 禁止内网 IP)
3. **规则误报优化**
   - 为每条规则添加 allowlist 机制 (注释 // skill-audit-ignore-next-line)
   - 测试文件自动降低严重程度 (test/ 目录下的 findings 降为 warn)
   - 改进 secret-leaks 规则减少 example/placeholder 误报
4. **测试** — 边界情况测试 (超大文件、深层嵌套目录、符号链接、二进制文件)

### Step 3: API + Web 生产化 (v0.8.0)
目标：API 和 Web 前端达到可部署状态

任务：
1. **API 加固**
   - 请求速率限制 (内存计数器, 默认 10 req/min/IP)
   - 请求 ID + 结构化日志 (JSON 格式)
   - 并发扫描限制 (最多 3 个同时扫描)
   - 优雅关闭 (SIGTERM 处理)
   - API 版本前缀 /v1/
2. **Web 前端完善**
   - 扫描历史列表 (localStorage)
   - 报告分享 (生成唯一 URL 或下载)
   - 规则说明弹窗 (点击 finding 查看详细说明)
   - 错误状态 UI (网络错误、超时、服务不可用)
   - 加载骨架屏
3. **Docker 支持**
   - Dockerfile (多阶段构建, 非 root 用户)
   - docker-compose.yml
   - 健康检查配置
4. **测试** — API 集成测试 (速率限制、并发、超时)

### Step 4: 文档 + 生态 (v0.9.0)
目标：文档完善，开发者体验一流

任务：
1. **API 文档**
   - OpenAPI/Swagger spec (docs/openapi.yaml)
   - 每个 endpoint 的请求/响应示例
2. **用户指南**
   - docs/getting-started.md — 5 分钟快速开始
   - docs/configuration.md — 配置文件完整说明
   - docs/custom-rules.md — 自定义规则开发指南
   - docs/deployment.md — 部署指南 (Docker, Vercel, Railway)
3. **开发者体验**
   - JSDoc 注释覆盖所有 public API
   - TypeScript 类型声明文件 (index.d.ts)
   - 更多示例插件 (examples/ 目录)
4. **CHANGELOG.md** — 从 v0.1.0 到 v0.9.0 的完整变更日志

### Step 5: 重构 + 安全审计 + 1.0 发布 (v1.0.0)
目标：代码质量达到开源标准，零安全问题

任务：
1. **代码重构**
   - bin/cli.js 拆分 (cli-parser.js + commands/*.js)，当前 264 行太臃肿
   - 统一所有规则的 scan 函数签名和返回格式
   - 提取公共工具函数 (src/utils.js: 颜色、文件操作、参数解析)
   - 消除重复代码 (reporter.js 和 html-reporter.js 的共享逻辑)
   - 确保所有模块的 import/export 一致性
2. **安全自审**
   - 用 skill-audit 扫描自身 (dogfooding)，修复所有 findings
   - 检查 server.js 的所有输入路径 (路径遍历、SSRF、命令注入)
   - 检查 plugin-loader.js 的动态 import 安全性
   - 确保 git clone 的 URL 不会导致命令注入
3. **代码质量**
   - 所有文件添加文件头注释 (用途、作者、license)
   - 统一代码风格 (分号、引号、缩进)
   - 移除所有 TODO/FIXME 或转为 GitHub Issues
   - 确保 0 个 lint 警告
4. **最终测试**
   - 测试覆盖率目标 > 90%
   - 端到端测试 (CLI → API → Web 完整流程)
   - 跨平台测试 (确保 Windows 路径兼容)
   - package.json 版本号 → 1.0.0
   - git tag v1.0.0
