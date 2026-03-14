// Permission audit: checks SKILL.md or manifest for declared permissions
// vs actual usage patterns in code files

const PERMISSION_INDICATORS = {
  filesystem: [/readFile|writeFile|readdir|mkdir|unlink|fs\.|open\(|with\s+open/gi, 'File system access'],
  network: [/fetch\(|http\.|https\.|requests\.|urllib|axios|curl|wget/gi, 'Network access'],
  exec: [/exec\(|spawn\(|child_process|subprocess|os\.system|os\.popen/gi, 'Command execution'],
  env: [/process\.env|os\.environ|getenv|dotenv/gi, 'Environment variable access'],
  crypto: [/crypto\.|hashlib|hmac|bcrypt|jwt/gi, 'Cryptographic operations'],
  database: [/mongodb|postgres|mysql|redis|sqlite|sequelize|prisma|mongoose/gi, 'Database access'],
};

export const permissionAudit = {
  id: 'permission-audit',
  name: 'Permission Audit',
  scan(content, file) {
    const findings = [];

    // Only scan code files for actual usage
    const codeExts = new Set(['.js', '.ts', '.py', '.sh', '.bash']);
    if (!codeExts.has(file.ext)) return findings;

    const lines = content.split('\n');
    const detected = new Map();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const [perm, [pattern, label]] of Object.entries(PERMISSION_INDICATORS)) {
        pattern.lastIndex = 0;
        if (pattern.test(line) && !detected.has(perm)) {
          detected.set(perm, { line: i + 1, snippet: line.trim().slice(0, 120) });
        }
      }
    }

    for (const [perm, { line, snippet }] of detected) {
      findings.push({
        rule: `permission-audit/${perm}`,
        severity: 'warn',
        file: file.rel,
        line,
        msg: `Uses ${PERMISSION_INDICATORS[perm][1]} — ensure this is declared and necessary`,
        snippet,
      });
    }

    return findings;
  },
};
