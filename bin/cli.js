#!/usr/bin/env node
import { resolve } from 'path';
import { audit } from '../src/index.js';
import { formatReport } from '../src/reporter.js';

const target = process.argv[2];

if (!target || target === '--help' || target === '-h') {
  console.log(`
  skill-audit — Security scanner for AI agent skills

  Usage:
    skill-audit <path>          Scan a skill directory
    skill-audit <path> --json   Output JSON report

  Examples:
    skill-audit ./my-skill
    npx skill-audit ./my-skill --json
`);
  process.exit(0);
}

const jsonMode = process.argv.includes('--json');
const targetPath = resolve(target);

try {
  const report = await audit(targetPath);
  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    formatReport(report);
  }
  process.exit(report.summary.danger > 0 ? 1 : 0);
} catch (err) {
  console.error(`\x1b[31m✗ Error: ${err.message}\x1b[0m`);
  process.exit(2);
}
