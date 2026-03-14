/**
 * @file rules/sandbox-escape.js
 * @description Detect container breakout and privilege escalation patterns
 * @license MIT
 */

const PATTERNS = [
  // Container escape
  { pattern: /\bmount\s+.*\/proc\b/g, id: 'mount-proc', msg: 'Mounting /proc — potential container escape', severity: 'danger' },
  { pattern: /\bmount\s+.*\/sys\b/g, id: 'mount-sys', msg: 'Mounting /sys — potential container escape', severity: 'danger' },
  // skill-audit-ignore-next-line
  { pattern: /--privileged\b/g, id: 'privileged', msg: '--privileged flag — full host access from container', severity: 'danger' },
  // skill-audit-ignore-next-line
  { pattern: /docker\.sock\b/g, id: 'docker-sock', msg: 'docker.sock access — container escape vector', severity: 'danger' },

  // Capability escalation
  // skill-audit-ignore-next-line
  { pattern: /\bCAP_SYS_ADMIN\b/g, id: 'cap-sys-admin', msg: 'CAP_SYS_ADMIN capability — near-root privileges', severity: 'danger' },
  // skill-audit-ignore-next-line
  { pattern: /--cap-add\b/g, id: 'cap-add', msg: '--cap-add — adding Linux capabilities', severity: 'warn' },
  // skill-audit-ignore-next-line
  { pattern: /\bsetuid\b/g, id: 'setuid', msg: 'setuid usage — privilege escalation risk', severity: 'warn' },
  // skill-audit-ignore-next-line
  { pattern: /\bsetgid\b/g, id: 'setgid', msg: 'setgid usage — privilege escalation risk', severity: 'warn' },

  // Namespace manipulation
  // skill-audit-ignore-next-line
  { pattern: /\bunshare\b/g, id: 'unshare', msg: 'unshare — namespace manipulation', severity: 'warn' },
  // skill-audit-ignore-next-line
  { pattern: /\bnsenter\b/g, id: 'nsenter', msg: 'nsenter — entering another namespace', severity: 'danger' },
  // skill-audit-ignore-next-line
  { pattern: /\bchroot\b/g, id: 'chroot', msg: 'chroot — filesystem root change', severity: 'warn' },
]

export const sandboxEscape = {
  id: 'sandbox-escape',
  name: 'Sandbox Escape',

  scan(content, file, _options) {
    const findings = []
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      for (const { pattern, id, msg, severity } of PATTERNS) {
        pattern.lastIndex = 0
        if (pattern.test(line)) {
          findings.push({
            rule: `sandbox-escape/${id}`,
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
