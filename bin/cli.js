#!/usr/bin/env node
import { resolve } from 'path';
import { audit } from '../src/index.js';
import { formatReport } from '../src/reporter.js';
import { calculateScore } from '../src/scorer.js';

const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith('--')));
const positional = args.filter(a => !a.startsWith('--'));

const target = positional[0];

if (!target || flags.has('--help') || args.includes('-h')) {
  console.log(`
  skill-audit — Security scanner for AI agent skills

  Usage:
    skill-audit <path>              Scan a skill directory
    skill-audit <path> --json       Output JSON report
    skill-audit <path> --lang zh    Show fix suggestions in Chinese

  Options:
    --json       Output JSON report
    --lang zh    Chinese fix suggestions (default: en)
    -h, --help   Show this help

  Examples:
    skill-audit ./my-skill
    skill-audit ./my-skill --lang zh
    npx skill-audit ./my-skill --json
`);
  process.exit(0);
}

const jsonMode = flags.has('--json');
let lang = 'en';
const langIdx = args.indexOf('--lang');
if (langIdx !== -1 && args[langIdx + 1]) {
  lang = args[langIdx + 1];
}

const targetPath = resolve(target);

try {
  const report = await audit(targetPath);
  const scoreResult = calculateScore(report.findings);

  if (jsonMode) {
    console.log(JSON.stringify({ ...report, score: scoreResult }, null, 2));
  } else {
    formatReport(report, { lang });
  }
  process.exit(report.summary.danger > 0 ? 1 : 0);
} catch (err) {
  console.error(`\x1b[31m✗ Error: ${err.message}\x1b[0m`);
  process.exit(2);
}
