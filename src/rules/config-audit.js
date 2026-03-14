/**
 * @file rules/config-audit.js
 * @description Configuration security audit — detect insecure config patterns
 * @license MIT
 */

const LINE_PATTERNS = [
  // Debug mode enabled
  { pattern: /\bdebug\s*[:=]\s*true\b/gi, id: 'debug-enabled', msg: 'Debug mode enabled — may expose sensitive info in production', severity: 'warn' },
  { pattern: /\bdebug\s*[:=]\s*['"]?enabled['"]?/gi, id: 'debug-enabled', msg: 'Debug mode enabled — may expose sensitive info in production', severity: 'warn' },
  { pattern: /\bverbose\s*[:=]\s*true\b/gi, id: 'verbose-logging', msg: 'Verbose logging enabled — may leak sensitive data', severity: 'warn' },

  // CORS wildcard
  { pattern: /Access-Control-Allow-Origin\s*[:=]\s*['"]?\*/g, id: 'cors-wildcard', msg: 'CORS wildcard (*) — allows any origin', severity: 'warn' },

  // TLS/SSL disabled
  // skill-audit-ignore-next-line
  { pattern: /rejectUnauthorized\s*[:=]\s*false/g, id: 'tls-reject-disabled', msg: 'TLS certificate verification disabled (rejectUnauthorized: false)', severity: 'danger' },
  // skill-audit-ignore-next-line
  { pattern: /\bverify\s*[:=]\s*false\b/g, id: 'ssl-verify-disabled', msg: 'SSL verification disabled (verify: false)', severity: 'warn' },
  // skill-audit-ignore-next-line
  { pattern: /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0['"]?/g, id: 'node-tls-disabled', msg: 'NODE_TLS_REJECT_UNAUTHORIZED=0 — disables all TLS verification', severity: 'danger' },

  // Insecure protocol in config-like contexts
  { pattern: /['"`]\s*http:\/\/[^'"`\s]+/g, id: 'insecure-http', msg: 'HTTP (non-TLS) URL in configuration — use HTTPS instead', severity: 'warn' },
]

// Files that are likely config files
const CONFIG_EXTENSIONS = new Set(['.yaml', '.yml', '.json', '.toml', '.env'])

export const configAudit = {
  id: 'config-audit',
  name: 'Configuration Audit',

  scan(content, file, _options) {
    const findings = []
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      for (const { pattern, id, msg, severity } of LINE_PATTERNS) {
        pattern.lastIndex = 0

        // For insecure-http, only flag in config files or config-like code
        if (id === 'insecure-http') {
          if (!CONFIG_EXTENSIONS.has(file.ext) && !isConfigContext(line)) continue
          // Skip localhost/127.0.0.1 — common in dev
          if (/http:\/\/(localhost|127\.0\.0\.1)\b/.test(line)) continue
        }

        if (pattern.test(line)) {
          findings.push({
            rule: `config-audit/${id}`,
            severity,
            file: file.rel,
            line: i + 1,
            msg,
            snippet: line.trim().slice(0, 120),
          })
        }
      }
    }

    return findings
  },
}

function isConfigContext(line) {
  return /(?:url|endpoint|host|server|api|base_url|baseUrl|origin)\s*[:=]/i.test(line)
}
