#!/usr/bin/env node
import { resolve } from 'path';
import { writeFile } from 'fs/promises';
import { audit } from '../src/index.js';
import { formatReport } from '../src/reporter.js';
import { generateHtml } from '../src/html-reporter.js';
import { calculateScore } from '../src/scorer.js';

const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith('--') || (a.startsWith('-') && a.length === 2)));
const positional = args.filter(a => !a.startsWith('-'));

// Parse named args helper
function getArg(long, short) {
  let idx = args.indexOf(long);
  if (idx === -1 && short) idx = args.indexOf(short);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return null;
}

const target = positional[0];

if (!target || flags.has('--help') || flags.has('-h')) {
  console.log(`
  skill-audit — Security scanner for AI agent skills

  Usage:
    skill-audit <path>                        Scan a skill directory
    skill-audit <path> --json                 Output JSON report
    skill-audit <path> --html -o report.html  Output HTML report
    skill-audit <path> --lang zh              Show fix suggestions in Chinese

  Options:
    --json             Output JSON report
    --html             Output HTML report
    --output, -o FILE  Output file path (used with --html or --json)
    --lang zh          Chinese fix suggestions (default: en)
    -h, --help         Show this help

  Examples:
    skill-audit ./my-skill
    skill-audit ./my-skill --lang zh
    skill-audit ./my-skill --html -o report.html
    npx skill-audit ./my-skill --json
`);
  process.exit(0);
}

const jsonMode = flags.has('--json');
const htmlMode = flags.has('--html');
const outputPath = getArg('--output', '-o');
let lang = 'en';
const langVal = getArg('--lang', null);
if (langVal) lang = langVal;

const targetPath = resolve(target);

try {
  const report = await audit(targetPath);
  const scoreResult = calculateScore(report.findings);

  if (htmlMode) {
    const html = generateHtml(report, { lang });
    if (outputPath) {
      await writeFile(resolve(outputPath), html, 'utf-8');
      console.log(`\x1b[32m✓ HTML report written to ${resolve(outputPath)}\x1b[0m`);
    } else {
      process.stdout.write(html);
    }
  } else if (jsonMode) {
    const json = JSON.stringify({ ...report, score: scoreResult }, null, 2);
    if (outputPath) {
      await writeFile(resolve(outputPath), json, 'utf-8');
      console.log(`\x1b[32m✓ JSON report written to ${resolve(outputPath)}\x1b[0m`);
    } else {
      console.log(json);
    }
  } else {
    formatReport(report, { lang });
  }
  process.exit(report.summary.danger > 0 ? 1 : 0);
} catch (err) {
  console.error(`\x1b[31m✗ Error: ${err.message}\x1b[0m`);
  process.exit(2);
}
