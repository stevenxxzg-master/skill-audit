// Dependency audit: detects suspicious packages, typosquatting,
// unpinned versions, and non-standard registries

const KNOWN_MALICIOUS_PATTERNS = [
  /\bcrosenv\b/i,
  /\bevent-stream\b/i,
  /\bflatmap-stream\b/i,
  /\bua-parser-js\b.*malicious/i,
  /\bcoa\b.*malicious/i,
  /\brc\b.*malicious/i,
  /\bcolors\.js\b.*malicious/i,
  /\bnode-ipc\b.*malicious/i,
];

// Common typosquatting targets: real name → suspicious misspellings
const TYPOSQUAT_PATTERNS = [
  { pattern: /\b(?:lodahs|lodasg|l0dash|lodash-es-utils)\b/i, msg: 'Possible typosquat of lodash' },
  { pattern: /\b(?:expres|expresss|exppress)\b/i, msg: 'Possible typosquat of express' },
  { pattern: /\b(?:reqeusts|requets|request-promise-any)\b/i, msg: 'Possible typosquat of requests/request' },
  { pattern: /\b(?:axois|axio|axioss)\b/i, msg: 'Possible typosquat of axios' },
  { pattern: /\b(?:reacr|reactt|raect)\b/i, msg: 'Possible typosquat of react' },
  { pattern: /\b(?:numpyy|nunpy|num-py)\b/i, msg: 'Possible typosquat of numpy' },
  { pattern: /\b(?:pandsa|pandass|pnadas)\b/i, msg: 'Possible typosquat of pandas' },
  { pattern: /\b(?:djnago|dajngo|djangoo)\b/i, msg: 'Possible typosquat of django' },
  { pattern: /\b(?:flaskk|flaask|flaski)\b/i, msg: 'Possible typosquat of flask' },
  { pattern: /\b(?:crytpography|cryptograhpy)\b/i, msg: 'Possible typosquat of cryptography' },
  { pattern: /\b(?:colorsss|colour-string)\b/i, msg: 'Possible typosquat of colors' },
  { pattern: /\b(?:chalkk|challk)\b/i, msg: 'Possible typosquat of chalk' },
];

// Known suspicious Python packages
const SUSPICIOUS_PYTHON_PATTERNS = [
  { pattern: /\b(?:python3-dateutil|python-dateutils)\b/i, msg: 'Suspicious Python package — possible typosquat of python-dateutil' },
  { pattern: /\b(?:jeIlyfish|jellyfihs)\b/i, msg: 'Suspicious Python package — possible typosquat of jellyfish' },
  { pattern: /\b(?:coloursama|coloramma)\b/i, msg: 'Suspicious Python package — possible typosquat of colorama' },
  { pattern: /\b(?:urllib-3|urlib3)\b/i, msg: 'Suspicious Python package — possible typosquat of urllib3' },
];

// Non-standard registry patterns
const NON_STANDARD_REGISTRY = [
  { pattern: /registry\s*[=:]\s*["']?https?:\/\/(?!registry\.npmjs\.org|registry\.yarnpkg\.com)[^\s"']+/gi, id: 'npm-custom-registry', msg: 'Non-standard npm registry configured' },
  { pattern: /--index-url\s+https?:\/\/(?!pypi\.org|files\.pythonhosted\.org)[^\s]+/gi, id: 'pip-custom-index', msg: 'Non-standard PyPI index configured' },
  { pattern: /--extra-index-url\s+https?:\/\/[^\s]+/gi, id: 'pip-extra-index', msg: 'Extra PyPI index — potential dependency confusion attack' },
];

// Unpinned dependency patterns
const UNPINNED_NPM = /["']([^"']+)["']\s*:\s*["'](\*|latest|>=?[^"']+|>[^"']+)["']/g;
const UNPINNED_PIP = /^([a-zA-Z0-9_-]+)\s*$/gm;
const UNPINNED_PIP_GTE = /^([a-zA-Z0-9_-]+)\s*>=?\s*[\d.]+\s*$/gm;

export const dependencyAudit = {
  id: 'dependency-audit',
  name: 'Dependency Audit',
  scan(content, file) {
    const findings = [];
    const lines = content.split('\n');
    const fname = file.rel.toLowerCase();

    const isPackageJson = fname.endsWith('package.json');
    const isRequirements = fname.endsWith('requirements.txt') || fname.includes('requirements/');
    const isPyproject = fname.endsWith('pyproject.toml');
    const isDependencyFile = isPackageJson || isRequirements || isPyproject;

    // Scan all files for typosquatting and malicious package names
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Known malicious packages
      for (const pattern of KNOWN_MALICIOUS_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(line)) {
          findings.push({
            rule: 'dependency-audit/malicious-package',
            severity: 'danger',
            file: file.rel,
            line: i + 1,
            msg: 'Known malicious package name detected',
            snippet: line.trim().slice(0, 120),
          });
        }
      }

      // Typosquatting (npm)
      for (const { pattern, msg } of TYPOSQUAT_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(line)) {
          findings.push({
            rule: 'dependency-audit/typosquat',
            severity: 'danger',
            file: file.rel,
            line: i + 1,
            msg,
            snippet: line.trim().slice(0, 120),
          });
        }
      }

      // Suspicious Python packages
      for (const { pattern, msg } of SUSPICIOUS_PYTHON_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(line)) {
          findings.push({
            rule: 'dependency-audit/suspicious-python',
            severity: 'danger',
            file: file.rel,
            line: i + 1,
            msg,
            snippet: line.trim().slice(0, 120),
          });
        }
      }

      // Non-standard registry
      for (const { pattern, id, msg } of NON_STANDARD_REGISTRY) {
        pattern.lastIndex = 0;
        if (pattern.test(line)) {
          findings.push({
            rule: `dependency-audit/${id}`,
            severity: 'warn',
            file: file.rel,
            line: i + 1,
            msg,
            snippet: line.trim().slice(0, 120),
          });
        }
      }
    }

    // Unpinned dependency checks — only on dependency files
    if (isPackageJson) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        UNPINNED_NPM.lastIndex = 0;
        let m;
        while ((m = UNPINNED_NPM.exec(line)) !== null) {
          const ver = m[2];
          if (ver === '*' || ver === 'latest' || /^>=?/.test(ver) || /^>/.test(ver)) {
            findings.push({
              rule: 'dependency-audit/unpinned-npm',
              severity: 'warn',
              file: file.rel,
              line: i + 1,
              msg: `Unpinned npm dependency "${m[1]}": "${ver}" — pin to exact version`,
              snippet: line.trim().slice(0, 120),
            });
          }
        }
      }
    }

    if (isRequirements) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('#') || line.startsWith('-')) continue;
        // Completely unpinned (just package name)
        if (/^[a-zA-Z0-9_-]+\s*$/.test(line)) {
          findings.push({
            rule: 'dependency-audit/unpinned-pip',
            severity: 'warn',
            file: file.rel,
            line: i + 1,
            msg: `Unpinned Python dependency "${line.trim()}" — pin to exact version`,
            snippet: line.slice(0, 120),
          });
        }
        // >= without upper bound
        if (/^[a-zA-Z0-9_-]+\s*>=\s*[\d.]+\s*$/.test(line)) {
          findings.push({
            rule: 'dependency-audit/loosely-pinned-pip',
            severity: 'warn',
            file: file.rel,
            line: i + 1,
            msg: `Loosely pinned Python dependency "${line.trim()}" — consider exact pinning`,
            snippet: line.slice(0, 120),
          });
        }
      }
    }

    if (isPyproject) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Detect "package>=x.y" or "package" without version in pyproject.toml dependencies
        if (/^\s*["']([a-zA-Z0-9_-]+)["']\s*,?\s*$/.test(line)) {
          const pkg = line.match(/["']([a-zA-Z0-9_-]+)["']/)[1];
          findings.push({
            rule: 'dependency-audit/unpinned-pyproject',
            severity: 'warn',
            file: file.rel,
            line: i + 1,
            msg: `Unpinned dependency "${pkg}" in pyproject.toml`,
            snippet: line.trim().slice(0, 120),
          });
        }
      }
    }

    return findings;
  },
};
