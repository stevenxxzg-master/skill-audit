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
  scan(content, file, _ctx) {
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

  /**
   * Post-scan: compare declared vs actual permissions using manifest
   * Called after all files have been scanned
   * @param {object|null} manifest - parsed manifest from parsers
   * @param {object[]} allFindings - all findings from scan phase
   * @returns {object[]} additional findings from manifest comparison
   */
  compareManifest(manifest, allFindings) {
    if (!manifest || !manifest.declaredPermissions || manifest.declaredPermissions.length === 0) {
      return [];
    }

    const findings = [];
    const declared = new Set(manifest.declaredPermissions);

    // Collect actual permissions detected across all files
    const actual = new Set();
    for (const f of allFindings) {
      if (f.rule.startsWith('permission-audit/')) {
        const perm = f.rule.split('/')[1];
        actual.add(perm);
      }
    }

    // Undeclared but actually used → danger
    for (const perm of actual) {
      if (!declared.has(perm)) {
        findings.push({
          rule: `permission-audit/undeclared-${perm}`,
          severity: 'danger',
          file: 'manifest',
          line: 0,
          msg: `Uses ${PERMISSION_INDICATORS[perm]?.[1] || perm} but not declared in manifest — potential undisclosed capability`,
          snippet: `actual: ${perm}, declared: [${[...declared].join(', ')}]`,
        });
      }
    }

    // Declared but not actually used → warn (over-declaration)
    for (const perm of declared) {
      if (!actual.has(perm) && PERMISSION_INDICATORS[perm]) {
        findings.push({
          rule: `permission-audit/unused-${perm}`,
          severity: 'warn',
          file: 'manifest',
          line: 0,
          msg: `Declares ${PERMISSION_INDICATORS[perm]?.[1] || perm} permission but doesn't appear to use it — over-declaration`,
          snippet: `declared: ${perm}, not detected in code`,
        });
      }
    }

    return findings;
  },
};
