/**
 * @file rules/dangerous-commands.js
 * @description Detect dangerous shell commands and code execution patterns
 * @license MIT
 */

const DANGEROUS_PATTERNS = [
  { pattern: /\brm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+|--force\s+).*\//g, id: 'rm-force', msg: 'Forced recursive delete detected', severity: 'danger' },
  { pattern: /\brm\s+-[a-zA-Z]*r[a-zA-Z]*\b/g, id: 'rm-recursive', msg: 'Recursive delete command', severity: 'danger' },
  // skill-audit-ignore-next-line
  { pattern: /\beval\s*\(/g, id: 'eval', msg: 'eval() usage — potential code injection', severity: 'danger' },
  // skill-audit-ignore-next-line
  { pattern: /\bexec\s*\(/g, id: 'exec-call', msg: 'exec() call — arbitrary command execution', severity: 'warn' },
  // skill-audit-ignore-next-line
  { pattern: /\bchild_process\b/g, id: 'child-process', msg: 'child_process import — can run arbitrary commands', severity: 'warn' },
  // skill-audit-ignore-next-line
  { pattern: /\bsubprocess\b/g, id: 'subprocess', msg: 'subprocess usage — can run arbitrary commands', severity: 'warn' },
  // skill-audit-ignore-next-line
  { pattern: /\bos\.system\s*\(/g, id: 'os-system', msg: 'os.system() — arbitrary command execution', severity: 'danger' },
  { pattern: /\bchmod\s+[0-7]*7[0-7]*\b/g, id: 'chmod-world', msg: 'World-writable permission set', severity: 'warn' },
  { pattern: /\bkill\s+-9\b/g, id: 'kill-9', msg: 'Force kill signal', severity: 'warn' },
  // skill-audit-ignore-next-line
  { pattern: /\bmkfs\b/g, id: 'mkfs', msg: 'Filesystem format command', severity: 'danger' },
  { pattern: /\bdd\s+if=/g, id: 'dd', msg: 'dd command — raw disk write', severity: 'danger' },
  { pattern: />\s*\/dev\/sd[a-z]/g, id: 'dev-write', msg: 'Direct write to block device', severity: 'danger' },
  { pattern: /\bFunction\s*\(/g, id: 'function-constructor', msg: 'Function constructor — dynamic code execution', severity: 'danger' },
  { pattern: /\b__import__\s*\(/g, id: 'dunder-import', msg: 'Dynamic __import__ — potential code injection', severity: 'warn' },
  // skill-audit-ignore-next-line
  { pattern: /\bimportlib\b/g, id: 'importlib', msg: 'Dynamic import via importlib', severity: 'warn' },
]

export const dangerousCommands = {
  id: 'dangerous-commands',
  name: 'Dangerous Commands',
  scan(content, file, _options) {
    const findings = []
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      for (const { pattern, id, msg, severity } of DANGEROUS_PATTERNS) {
        pattern.lastIndex = 0
        if (pattern.test(line)) {
          findings.push({
            rule: `dangerous-commands/${id}`,
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
