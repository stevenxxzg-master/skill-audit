/**
 * @file rules/secret-leaks.js
 * @description Detect hardcoded secrets, API keys, tokens, and credentials
 * @license MIT
 */

const SECRET_PATTERNS = [
  { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][A-Za-z0-9_\-]{16,}['"]/gi, id: 'api-key', msg: 'Hardcoded API key', severity: 'danger' },
  { pattern: /(?:secret|password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/gi, id: 'secret', msg: 'Hardcoded secret/password', severity: 'danger' },
  { pattern: /(?:token)\s*[:=]\s*['"][A-Za-z0-9_\-\.]{16,}['"]/gi, id: 'token', msg: 'Hardcoded token', severity: 'danger' },
  { pattern: /AKIA[0-9A-Z]{16}/g, id: 'aws-key', msg: 'AWS Access Key ID detected', severity: 'danger' },
  { pattern: /sk-[A-Za-z0-9]{32,}/g, id: 'openai-key', msg: 'OpenAI API key detected', severity: 'danger' },
  { pattern: /ghp_[A-Za-z0-9]{36,}/g, id: 'github-token', msg: 'GitHub personal access token', severity: 'danger' },
  { pattern: /glpat-[A-Za-z0-9\-_]{20,}/g, id: 'gitlab-token', msg: 'GitLab personal access token', severity: 'danger' },
  { pattern: /xox[bpors]-[A-Za-z0-9\-]{10,}/g, id: 'slack-token', msg: 'Slack token detected', severity: 'danger' },
  { pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g, id: 'private-key', msg: 'Private key embedded in file', severity: 'danger' },
  // skill-audit-ignore-next-line
  { pattern: /(?:mongodb|postgres|mysql|redis):\/\/[^\s'"]{10,}/gi, id: 'db-uri', msg: 'Database connection string with credentials', severity: 'danger' },
  { pattern: /Bearer\s+[A-Za-z0-9_\-\.]{20,}/g, id: 'bearer-token', msg: 'Bearer token in code', severity: 'warn' },
]

// Words that indicate placeholder/example values — skip these lines
const FALSE_POSITIVE_WORDS = /(?:^|[\s'"=:_\-/])(example|placeholder|dummy|test|sample|xxx)(?:[\s'"=:_\-/]|$)/i

// Files that are inherently example/template files
const SKIP_FILES = new Set(['.env.example', '.env.sample', '.env.template'])

/**
 * Check if a line is inside a markdown code block example in README files
 */
function isInReadmeCodeBlock(lines, lineIndex, file) {
  if (!/readme\.md$/i.test(file.rel)) return false
  let inCodeBlock = false
  for (let i = 0; i < lineIndex; i++) {
    if (/^```/.test(lines[i].trim())) {
      inCodeBlock = !inCodeBlock
    }
  }
  return inCodeBlock
}

export const secretLeaks = {
  id: 'secret-leaks',
  name: 'Secret & Credential Leaks',
  scan(content, file, _options) {
    // Skip common false-positive files
    if (file.rel === 'package-lock.json' || file.rel === 'yarn.lock') return []

    // Skip .env.example and similar template files
    const basename = file.rel.split('/').pop()
    if (SKIP_FILES.has(basename)) return []

    const findings = []
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Skip comments that look like examples
      if (/^\s*(#|\/\/)\s*(example|todo|fixme|placeholder)/i.test(line)) continue
      // Skip lines containing placeholder/example words
      if (FALSE_POSITIVE_WORDS.test(line)) continue
      // Skip lines inside README code blocks
      if (isInReadmeCodeBlock(lines, i, file)) continue

      for (const { pattern, id, msg, severity } of SECRET_PATTERNS) {
        pattern.lastIndex = 0
        if (pattern.test(line)) {
          findings.push({
            rule: `secret-leaks/${id}`,
            severity,
            file: file.rel,
            line: i + 1,
            msg,
            snippet: line.trim().slice(0, 80).replace(/([A-Za-z0-9_\-]{4})[A-Za-z0-9_\-]{8,}/g, '$1****'),
          })
        }
      }
    }
    return findings
  },
}
