const COLORS = {
  danger: '\x1b[31m',
  warn: '\x1b[33m',
  pass: '\x1b[32m',
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
};

const ICONS = {
  danger: '✗',
  warn: '⚠',
  pass: '✓',
};

export function formatReport(report) {
  const { findings, summary, target, files } = report;

  console.log();
  console.log(`${COLORS.bold}  skill-audit${COLORS.reset}  ${COLORS.dim}${target}${COLORS.reset}`);
  console.log(`${COLORS.dim}  Scanned ${summary.files} files${COLORS.reset}`);
  console.log();

  if (findings.length === 0) {
    console.log(`  ${COLORS.pass}${ICONS.pass} No issues found${COLORS.reset}`);
    console.log();
    return;
  }

  // Group by file
  const byFile = new Map();
  for (const f of findings) {
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file).push(f);
  }

  for (const [file, items] of byFile) {
    console.log(`  ${COLORS.cyan}${file}${COLORS.reset}`);
    for (const item of items) {
      const color = COLORS[item.severity];
      const icon = ICONS[item.severity];
      console.log(`    ${color}${icon}${COLORS.reset} ${COLORS.dim}L${item.line}${COLORS.reset} ${item.msg}`);
      if (item.snippet) {
        console.log(`      ${COLORS.dim}${item.snippet}${COLORS.reset}`);
      }
    }
    console.log();
  }

  // Summary bar
  const parts = [];
  if (summary.danger > 0) parts.push(`${COLORS.danger}${summary.danger} danger${COLORS.reset}`);
  if (summary.warn > 0) parts.push(`${COLORS.warn}${summary.warn} warning${COLORS.reset}`);
  if (parts.length === 0) parts.push(`${COLORS.pass}all clear${COLORS.reset}`);

  console.log(`  ${COLORS.bold}Summary:${COLORS.reset} ${parts.join('  ')}`);
  console.log();
}
