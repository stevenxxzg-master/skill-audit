# Changelog

All notable changes to skill-audit are documented here.

## [0.9.0] - 2026-03-14

### Added
- OpenAPI 3.0 specification (`docs/openapi.yaml`)
- User guide documentation: getting-started, configuration, custom-rules, deployment
- JSDoc comments on all public API functions
- TypeScript type declarations (`index.d.ts`)
- Example plugins: `regex-rule.js`, `async-rule.js`
- CHANGELOG.md

### Changed
- Updated README with Quick Start, Docker usage, and rule count (11)
- Version bump to 0.9.0

## [0.8.0] - 2026-03-14

### Added
- API rate limiting (10 req/min/IP, in-memory)
- Concurrency limiter (max 3 simultaneous scans)
- Request IDs (`X-Request-Id` header) + structured JSON logging
- Graceful shutdown on SIGTERM/SIGINT
- API version prefix `/v1/` (all endpoints accessible via `/v1/...`)
- Dockerfile (multi-stage build, non-root user, healthcheck)
- docker-compose.yml (read-only filesystem, tmpfs, security options)
- Request timeout (30s)
- Path traversal protection for extracted archives
- URL sanitization (block file://, private IPs, shell injection chars)

### Changed
- Server rewritten with production-grade error handling

## [0.7.0] - 2026-03-14

### Added
- `// skill-audit-ignore-next-line` inline suppression comments
- Test file severity reduction (findings in `test/` directories downgraded)
- Symlink loop detection during file collection
- File count limit (1000 files) and total size limit (50MB)
- CLI `--verbose` mode for detailed rule output
- CLI `--quiet` mode for score-only output
- CLI `--exit-zero` to ignore danger exit codes
- Input validation for CLI arguments
- `src/utils.js` — shared utility functions (isPrivateIp, sanitizeUrl, hasPathTraversal)

### Improved
- Secret leaks rule: reduced false positives for example/placeholder values
- Error messages across all async functions

## [0.6.0] - 2026-03-13

### Added
- **Sandbox Escape** rule (`src/rules/sandbox-escape.js`) — detects container escape patterns, capability escalation, namespace operations
- **Config Audit** rule (`src/rules/config-audit.js`) — detects insecure YAML/JSON config (debug mode, CORS *, TLS disabled)
- Total built-in rules: 11

### Fixed
- package.json version corrected from 0.4.0

## [0.5.0] - 2026-03-13

### Added
- **Encoding Audit** rule — Unicode bidi control chars (Trojan Source), zero-width chars, suspicious base64
- **Supply Chain Audit** rule — postinstall scripts, custom npm registries, Dockerfile remote fetch
- Scan history (`src/history.js`) — save/load/getLatest for tracking scans over time
- Diff reports (`src/diff.js`) — compare two scans, track added/fixed/kept findings
- Plugin system (`src/plugin-loader.js`) — load custom rules from a directory
- Configuration file support (`src/config.js`) — `.skillauditrc.json` / `skill-audit.config.js`
- `examples/custom-rule.js` — example plugin

### Changed
- Total built-in rules: 9

## [0.4.0] - 2026-03-12

### Added
- **File System Audit** rule — sensitive path access, symlink attacks, /tmp usage
- **Dependency Audit** rule — typosquatting, malicious packages, unpinned versions, custom registries
- Manifest parsers for OpenClaw, LangChain, CrewAI skill formats
- Permission audit manifest comparison (declared vs actual permissions)

## [0.3.0] - 2026-03-12

### Added
- HTTP API server (`src/server.js`) — file upload scan, URL scan, badge endpoint, health check
- SVG badge generator (`src/badge.js`) — shields.io-style security badges
- HTML report output (`--html` flag)
- Web frontend (`web/index.html`)

## [0.2.0] - 2026-03-11

### Added
- Security scoring system (`src/scorer.js`) — 0-100 score with A-F grades
- **Suspicious Network** rule — curl|bash, data exfiltration, raw IP requests, tunnel services
- **Permission Audit** rule — filesystem, network, exec, env, crypto, database access detection
- Fix suggestions with i18n support (`--lang zh` for Chinese)
- JSON output (`--json` flag)
- GitHub Action example

## [0.1.0] - 2026-03-11

### Added
- Initial release
- **Dangerous Commands** rule — rm -rf, eval(), exec(), dd, mkfs, Function()
- **Secret Leaks** rule — API keys, tokens, passwords, private keys, DB URIs
- **Prompt Injection** rule — instruction override, role hijacking, jailbreak patterns, LLM special tokens
- CLI with colored terminal output
- Exit codes (0 = clean, 1 = danger found, 2 = error)
