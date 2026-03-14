/**
 * Sandbox escape detection — detect container breakout and privilege escalation
 * Catches: container escape, capability escalation, namespace manipulation
 */

const PATTERNS = [
  // Container escape
  { pattern: /\bmount\s+.*\/proc\b/g, id: 'mount-proc', msg: 'Mounting /proc — potential container escape', severity: 'danger' },
  { pattern: /\bmount\s+.*\/sys\b/g, id: 'mount-sys', msg: 'Mounting /sys — potential container escape', severity: 'danger' },
  { pattern: /--privileged\b/g, id: 'privileged', msg: '--privileged flag — full host access from container', severity: 'danger' },
  { pattern: /docker\.sock\b/g, id: 'docker-sock', msg: 'docker.sock access — container escape vector', severity: 'danger' },

  // Capability escalation
  { pattern: /\bCAP_SYS_ADMIN\b/g, id: 'cap-sys-admin', msg: 'CAP_SYS_ADMIN capability — near-root privileges', severity: 'danger' },
  { pattern: /--cap-add\b/g, id: 'cap-add', msg: '--cap-add — adding Linux capabilities', severity: 'warn' },
  { pattern: /\bsetuid\b/g, id: 'setuid', msg: 'setuid usage — privilege escalation risk', severity: 'warn' },
  { pattern: /\bsetgid\b/g, id: 'setgid', msg: 'setgid usage — privilege escalation risk', severity: 'warn' },

  // Namespace manipulation
  { pattern: /\bunshare\b/g, id: 'unshare', msg: 'unshare — namespace manipulation', severity: 'warn' },
  { pattern: /\bnsenter\b/g, id: 'nsenter', msg: 'nsenter — entering another namespace', severity: 'danger' },
  { pattern: /\bchroot\b/g, id: 'chroot', msg: 'chroot — filesystem root change', severity: 'warn' },
];

export const sandboxEscape = {
  id: 'sandbox-escape',
  name: 'Sandbox Escape',

  scan(content, file) {
    const findings = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const { pattern, id, msg, severity } of PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(line)) {
          findings.push({
            rule: `sandbox-escape/${id}`,
            severity,
            file: file.rel,
            line: i + 1,
            msg,
            snippet: line.trim().slice(0, 120),
          });
        }
      }
    }

    return findings;
  },
};
