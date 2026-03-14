/**
 * @file rules/encoding-audit.js
 * @description Detect hidden/obfuscated content via Unicode tricks and base64
 * @license MIT
 */

// Unicode direction control characters (Trojan Source attack vectors)
const BIDI_CHARS = [
  { char: '\u202A', name: 'LRE', code: 'U+202A' },
  { char: '\u202B', name: 'RLE', code: 'U+202B' },
  { char: '\u202C', name: 'PDF', code: 'U+202C' },
  { char: '\u202D', name: 'LRO', code: 'U+202D' },
  { char: '\u202E', name: 'RLO', code: 'U+202E' },
  { char: '\u2066', name: 'LRI', code: 'U+2066' },
  { char: '\u2067', name: 'RLI', code: 'U+2067' },
  { char: '\u2068', name: 'FSI', code: 'U+2068' },
  { char: '\u2069', name: 'PDI', code: 'U+2069' },
  { char: '\u200F', name: 'RLM', code: 'U+200F' },
  { char: '\u200E', name: 'LRM', code: 'U+200E' },
]

// Zero-width characters that can hide content
const ZERO_WIDTH_CHARS = [
  { char: '\u200B', name: 'Zero-width space', code: 'U+200B' },
  { char: '\u200C', name: 'Zero-width non-joiner', code: 'U+200C' },
  { char: '\u200D', name: 'Zero-width joiner', code: 'U+200D' },
  { char: '\uFEFF', name: 'BOM / zero-width no-break space', code: 'U+FEFF' },
]

// Suspicious base64 patterns
// skill-audit-ignore-next-line
const DANGEROUS_B64_KEYWORDS = ['eval(', 'exec(', 'Function(', 'child_process', 'require(', 'import(', '/bin/sh', '/bin/bash', 'curl ', 'wget ']

const MIN_B64_LENGTH = 40

const B64_REGEX = /(?:^|["'`=\s])([A-Za-z0-9+/]{40,}={0,2})(?:["'`\s;,)]|$)/gm

export const encodingAudit = {
  id: 'encoding-audit',
  name: 'Encoding Audit',

  scan(content, file, _options) {
    const findings = []
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Check bidi control characters
      for (const bidi of BIDI_CHARS) {
        if (line.includes(bidi.char)) {
          findings.push({
            rule: 'encoding-audit/bidi-control',
            severity: 'danger',
            file: file.rel,
            line: i + 1,
            msg: `Unicode bidirectional control character ${bidi.name} (${bidi.code}) — potential Trojan Source attack`,
            snippet: line.trim().slice(0, 120),
          })
        }
      }

      // Check zero-width characters (skip line 1 BOM which is common)
      for (const zw of ZERO_WIDTH_CHARS) {
        if (zw.code === 'U+FEFF' && i === 0 && line.indexOf(zw.char) === 0) continue
        if (line.includes(zw.char)) {
          findings.push({
            rule: 'encoding-audit/zero-width',
            severity: 'warn',
            file: file.rel,
            line: i + 1,
            msg: `${zw.name} (${zw.code}) detected — may hide malicious content`,
            snippet: line.trim().slice(0, 120),
          })
        }
      }

      // Check suspicious base64 strings
      let match
      B64_REGEX.lastIndex = 0
      // skill-audit-ignore-next-line
      while ((match = B64_REGEX.exec(line)) !== null) {
        const b64str = match[1]
        if (b64str.length < MIN_B64_LENGTH) continue

        try {
          const decoded = Buffer.from(b64str, 'base64').toString('utf-8')
          const hasDangerous = DANGEROUS_B64_KEYWORDS.some(kw => decoded.includes(kw))
          if (hasDangerous) {
            findings.push({
              rule: 'encoding-audit/suspicious-base64',
              severity: 'danger',
              file: file.rel,
              line: i + 1,
              msg: 'Base64 string decodes to suspicious content (possible obfuscated code)',
              snippet: b64str.slice(0, 60) + '...',
            })
            continue
          }
        } catch {
          // Not valid base64, skip
        }

        // Flag very long base64 strings as potential obfuscation
        if (b64str.length >= 200) {
          findings.push({
            rule: 'encoding-audit/long-base64',
            severity: 'warn',
            file: file.rel,
            line: i + 1,
            msg: `Long base64 string (${b64str.length} chars) — potential obfuscated payload`,
            snippet: b64str.slice(0, 60) + '...',
          })
        }
      }
    }

    return findings
  },
}
