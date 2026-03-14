/**
 * @file rules/file-system-audit.js
 * @description Detect access to sensitive paths, system dir writes, symlink attacks
 * @license MIT
 */

const SENSITIVE_READ_PATTERNS = [
  // skill-audit-ignore-next-line
  { pattern: /\/etc\/passwd/g, id: 'read-etc-passwd', msg: 'Reading /etc/passwd — sensitive system file' },
  // skill-audit-ignore-next-line
  { pattern: /\/etc\/shadow/g, id: 'read-etc-shadow', msg: 'Reading /etc/shadow — password hashes file', severity: 'danger' },
  // skill-audit-ignore-next-line
  { pattern: /\/etc\/master\.passwd/g, id: 'read-master-passwd', msg: 'Reading /etc/master.passwd — BSD password file', severity: 'danger' },
  // skill-audit-ignore-next-line
  { pattern: /~\/\.ssh\/|\/\.ssh\/|\.ssh\/id_|\.ssh\/authorized_keys|\.ssh\/known_hosts/g, id: 'read-ssh', msg: 'Accessing ~/.ssh/ — SSH keys and config' },
  // skill-audit-ignore-next-line
  { pattern: /~\/\.aws\/|\/\.aws\/credentials|\/\.aws\/config/g, id: 'read-aws', msg: 'Accessing ~/.aws/ — AWS credentials' },
  // skill-audit-ignore-next-line
  { pattern: /~\/\.gnupg\/|\/\.gnupg\//g, id: 'read-gnupg', msg: 'Accessing ~/.gnupg/ — GPG keys' },
  // skill-audit-ignore-next-line
  { pattern: /~\/\.kube\/config|\/\.kube\/config/g, id: 'read-kube', msg: 'Accessing ~/.kube/config — Kubernetes credentials' },
  // skill-audit-ignore-next-line
  { pattern: /\/etc\/sudoers/g, id: 'read-sudoers', msg: 'Reading /etc/sudoers — privilege escalation config' },
  // skill-audit-ignore-next-line
  { pattern: /~\/\.env|\/\.env\b/g, id: 'read-dotenv', msg: 'Accessing .env file — may contain secrets' },
  { pattern: /~\/\.netrc|\/\.netrc/g, id: 'read-netrc', msg: 'Accessing .netrc — stored credentials' },
  { pattern: /~\/\.docker\/config\.json|\/\.docker\/config\.json/g, id: 'read-docker-creds', msg: 'Accessing Docker config — may contain registry credentials' },
]

const SYSTEM_WRITE_PATTERNS = [
  // skill-audit-ignore-next-line
  { pattern: /(?:write|append|>|>>)\s*.*\/usr\//g, id: 'write-usr', msg: 'Writing to /usr/ — system directory modification' },
  // skill-audit-ignore-next-line
  { pattern: /(?:write|append|>|>>)\s*.*\/bin\//g, id: 'write-bin', msg: 'Writing to /bin/ — system binary modification' },
  // skill-audit-ignore-next-line
  { pattern: /(?:write|append|>|>>)\s*.*\/sbin\//g, id: 'write-sbin', msg: 'Writing to /sbin/ — system binary modification' },
  // skill-audit-ignore-next-line
  { pattern: /(?:write|append|>|>>)\s*.*\/etc\//g, id: 'write-etc', msg: 'Writing to /etc/ — system config modification' },
  // skill-audit-ignore-next-line
  { pattern: /writeFile.*['"`]\/usr\//g, id: 'writefile-usr', msg: 'writeFile to /usr/ — system directory modification' },
  // skill-audit-ignore-next-line
  { pattern: /writeFile.*['"`]\/bin\//g, id: 'writefile-bin', msg: 'writeFile to /bin/ — system binary modification' },
  // skill-audit-ignore-next-line
  { pattern: /writeFile.*['"`]\/etc\//g, id: 'writefile-etc', msg: 'writeFile to /etc/ — system config modification' },
  { pattern: /open\s*\(\s*['"`]\/usr\//g, id: 'open-usr', msg: 'Opening /usr/ for write — system directory' },
  { pattern: /open\s*\(\s*['"`]\/bin\//g, id: 'open-bin', msg: 'Opening /bin/ for write — system binary' },
  { pattern: /open\s*\(\s*['"`]\/etc\//g, id: 'open-etc', msg: 'Opening /etc/ for write — system config' },
]

const SYMLINK_PATTERNS = [
  { pattern: /symlink\s*\(/g, id: 'symlink-create', msg: 'Symlink creation — potential symlink attack vector' },
  { pattern: /os\.symlink\s*\(/g, id: 'py-symlink', msg: 'Python symlink creation — potential symlink attack vector' },
  // skill-audit-ignore-next-line
  { pattern: /ln\s+-[a-zA-Z]*s/g, id: 'ln-symlink', msg: 'ln -s command — symlink creation' },
  { pattern: /readlink\s*\(/g, id: 'readlink', msg: 'Symlink resolution — check for TOCTOU race conditions' },
  { pattern: /lstat\s*\(/g, id: 'lstat-check', msg: 'lstat check — verify symlink handling is safe' },
]

const TEMP_FILE_PATTERNS = [
  { pattern: /['"`]\/tmp\/[a-zA-Z]/g, id: 'hardcoded-tmp', msg: 'Hardcoded /tmp/ path — predictable temp file, race condition risk' },
  { pattern: /['"`]\/var\/tmp\//g, id: 'hardcoded-var-tmp', msg: 'Hardcoded /var/tmp/ path — predictable temp file' },
  // skill-audit-ignore-next-line
  { pattern: /tmpnam\s*\(/g, id: 'tmpnam', msg: 'tmpnam() usage — insecure temp file creation (TOCTOU race)' },
  // skill-audit-ignore-next-line
  { pattern: /tempnam\s*\(/g, id: 'tempnam', msg: 'tempnam() usage — insecure temp file creation (TOCTOU race)' },
  // skill-audit-ignore-next-line
  { pattern: /mktemp\b(?!\s+-d)/g, id: 'mktemp-file', msg: 'mktemp without -d — verify secure usage' },
  { pattern: /open\s*\(\s*['"`]\/tmp\//g, id: 'open-tmp', msg: 'Opening file in /tmp/ directly — use mkstemp/tempfile instead' },
  { pattern: /writeFile.*['"`]\/tmp\//g, id: 'writefile-tmp', msg: 'Writing to /tmp/ with predictable name — race condition risk' },
]

export const fileSystemAudit = {
  id: 'file-system-audit',
  name: 'File System Audit',
  scan(content, file, _options) {
    const findings = []
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Sensitive path reads
      for (const { pattern, id, msg, severity } of SENSITIVE_READ_PATTERNS) {
        pattern.lastIndex = 0
        if (pattern.test(line)) {
          findings.push({
            rule: `file-system-audit/${id}`,
            severity: severity || 'warn',
            file: file.rel,
            line: i + 1,
            msg,
            snippet: line.trim().slice(0, 120),
          })
        }
      }

      // System directory writes
      for (const { pattern, id, msg } of SYSTEM_WRITE_PATTERNS) {
        pattern.lastIndex = 0
        if (pattern.test(line)) {
          findings.push({
            rule: `file-system-audit/${id}`,
            severity: 'danger',
            file: file.rel,
            line: i + 1,
            msg,
            snippet: line.trim().slice(0, 120),
          })
        }
      }

      // Symlink attacks
      for (const { pattern, id, msg } of SYMLINK_PATTERNS) {
        pattern.lastIndex = 0
        if (pattern.test(line)) {
          findings.push({
            rule: `file-system-audit/${id}`,
            severity: 'warn',
            file: file.rel,
            line: i + 1,
            msg,
            snippet: line.trim().slice(0, 120),
          })
        }
      }

      // Insecure temp file usage
      for (const { pattern, id, msg } of TEMP_FILE_PATTERNS) {
        pattern.lastIndex = 0
        if (pattern.test(line)) {
          findings.push({
            rule: `file-system-audit/${id}`,
            severity: 'warn',
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
