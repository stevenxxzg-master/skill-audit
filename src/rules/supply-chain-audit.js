/**
 * @file rules/supply-chain-audit.js
 * @description Detect package/container supply chain risks
 * @license MIT
 */

const DANGEROUS_SCRIPTS = ['preinstall', 'postinstall', 'preuninstall', 'postuninstall', 'prepare']

const OFFICIAL_REGISTRIES = [
  'https://registry.npmjs.org',
  'https://registry.yarnpkg.com',
]

function isOfficialRegistry(url) {
  return OFFICIAL_REGISTRIES.some(r => url.startsWith(r))
}

export const supplyChainAudit = {
  id: 'supply-chain-audit',
  name: 'Supply Chain Audit',

  scan(content, file, _options) {
    const findings = []
    const lines = content.split('\n')
    const filename = file.rel

    // ─── package.json checks ───
    if (filename === 'package.json' || filename.endsWith('/package.json')) {
      let pkg
      try {
        pkg = JSON.parse(content)
      } catch {
        return findings
      }

      // Check install lifecycle scripts
      if (pkg.scripts) {
        for (const scriptName of DANGEROUS_SCRIPTS) {
          if (pkg.scripts[scriptName]) {
            const lineNum = findLineNumber(lines, `"${scriptName}"`)
            findings.push({
              rule: 'supply-chain-audit/install-script',
              severity: 'warn',
              file: file.rel,
              line: lineNum,
              msg: `Lifecycle script "${scriptName}" detected — runs automatically on install`,
              snippet: `"${scriptName}": "${pkg.scripts[scriptName]}"`.slice(0, 120),
            })
          }
        }
      }

      // Check publishConfig registry
      if (pkg.publishConfig?.registry) {
        if (!isOfficialRegistry(pkg.publishConfig.registry)) {
          const lineNum = findLineNumber(lines, 'registry')
          findings.push({
            rule: 'supply-chain-audit/custom-registry',
            severity: 'warn',
            file: file.rel,
            line: lineNum,
            msg: `Custom publish registry: ${pkg.publishConfig.registry}`,
            snippet: `"registry": "${pkg.publishConfig.registry}"`.slice(0, 120),
          })
        }
      }
    }

    // ─── .npmrc checks ───
    if (filename === '.npmrc' || filename.endsWith('/.npmrc')) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        const registryMatch = line.match(/^registry\s*=\s*(.+)/)
        if (registryMatch) {
          const url = registryMatch[1].trim()
          if (!isOfficialRegistry(url)) {
            findings.push({
              rule: 'supply-chain-audit/custom-registry',
              severity: 'warn',
              file: file.rel,
              line: i + 1,
              msg: `Custom npm registry configured: ${url}`,
              snippet: line.slice(0, 120),
            })
          }
        }
      }
    }

    // ─── Dockerfile checks ───
    if (filename === 'Dockerfile' || filename.endsWith('/Dockerfile')) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()

        // skill-audit-ignore-next-line
        // curl/wget piped to shell
        if (/\b(curl|wget)\b.*\|\s*(sh|bash|zsh)\b/.test(line)) {
          findings.push({
            rule: 'supply-chain-audit/pipe-to-shell',
            severity: 'danger',
            file: file.rel,
            line: i + 1,
            msg: 'Remote script piped to shell — potential supply chain attack',
            snippet: line.slice(0, 120),
          })
        }

        // ADD from remote URL
        if (/^\s*ADD\s+https?:\/\//i.test(line)) {
          findings.push({
            rule: 'supply-chain-audit/remote-add',
            severity: 'warn',
            file: file.rel,
            line: i + 1,
            msg: 'ADD from remote URL — use COPY with verified local files instead',
            snippet: line.slice(0, 120),
          })
        }
      }
    }

    return findings
  },
}

function findLineNumber(lines, needle) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(needle)) return i + 1
  }
  return 1
}
