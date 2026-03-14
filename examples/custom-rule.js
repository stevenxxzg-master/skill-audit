// Example custom rule plugin for skill-audit
// Detects TODO/FIXME comments related to security issues
//
// Usage: skill-audit ./my-skill --plugins ./examples

const SECURITY_KEYWORDS = /\b(auth|token|secret|password|credential|encrypt|decrypt|permission|privilege|vulnerability|exploit|injection|sanitize|escape|csrf|xss|cors|ssl|tls|cert)\b/i;

const TODO_PATTERN = /(?:\/\/|#|\/\*)\s*(?:TODO|FIXME|HACK|XXX)\b[:\s]*(.*)/gi;

export default {
  id: 'security-todo',
  name: 'Security-Related TODO/FIXME',
  scan(content, file) {
    const findings = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      TODO_PATTERN.lastIndex = 0;
      let match;
      while ((match = TODO_PATTERN.exec(line)) !== null) {
        const comment = match[1] || line;
        if (SECURITY_KEYWORDS.test(comment)) {
          findings.push({
            rule: 'security-todo/unresolved',
            severity: 'warn',
            file: file.rel,
            line: i + 1,
            msg: 'Unresolved security-related TODO/FIXME',
            snippet: line.trim().slice(0, 120),
          });
        }
      }
    }

    return findings;
  },
};
