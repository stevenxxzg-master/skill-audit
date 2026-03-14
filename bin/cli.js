#!/usr/bin/env node
import { resolve } from 'path';
import { readFile, writeFile } from 'fs/promises';
import { audit } from '../src/index.js';
import { formatReport } from '../src/reporter.js';
import { generateHtml } from '../src/html-reporter.js';
import { calculateScore } from '../src/scorer.js';
import { diffReports } from '../src/diff.js';
import { saveReport, loadHistory, getLatest } from '../src/history.js';
import { generateBadge } from '../src/badge.js';
import { createServer } from '../src/server.js';

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

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

// ─── Subcommands ───

const subcommand = positional[0];

// skill-audit history <path>
if (subcommand === 'history') {
  const targetDir = positional[1];
  if (!targetDir) {
    console.error(`${COLORS.red}✗ Usage: skill-audit history <skill-dir>${COLORS.reset}`);
    process.exit(2);
  }
  const limitVal = getArg('--limit', '-n');
  const limit = limitVal ? parseInt(limitVal, 10) : undefined;
  const history = await loadHistory(resolve(targetDir), limit);
  if (history.length === 0) {
    console.log(`${COLORS.dim}No scan history found for ${targetDir}${COLORS.reset}`);
    process.exit(0);
  }
  console.log(`\n${COLORS.bold}  Scan history${COLORS.reset}  ${COLORS.dim}${resolve(targetDir)}${COLORS.reset}\n`);
  for (const r of history) {
    const date = new Date(r.timestamp).toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z');
    const score = calculateScore(r.findings || []);
    const dangerCount = (r.summary && r.summary.danger) || 0;
    const warnCount = (r.summary && r.summary.warn) || 0;
    const scoreColor = score.score >= 70 ? COLORS.green : score.score >= 40 ? COLORS.yellow : COLORS.red;
    console.log(`  ${COLORS.dim}${date}${COLORS.reset}  ${scoreColor}${score.score}/100 ${score.grade}${COLORS.reset}  ${COLORS.red}${dangerCount}D${COLORS.reset} ${COLORS.yellow}${warnCount}W${COLORS.reset}`);
  }
  console.log();
  process.exit(0);
}

// skill-audit diff <old.json> <new.json>
if (subcommand === 'diff') {
  const oldPath = positional[1];
  const newPath = positional[2];
  if (!oldPath || !newPath) {
    console.error(`${COLORS.red}✗ Usage: skill-audit diff <old.json> <new.json>${COLORS.reset}`);
    process.exit(2);
  }
  const oldReport = JSON.parse(await readFile(resolve(oldPath), 'utf-8'));
  const newReport = JSON.parse(await readFile(resolve(newPath), 'utf-8'));
  const diff = diffReports(oldReport, newReport);
  printDiffResult(diff);
  process.exit(0);
}

function printDiffResult(diff) {
  console.log(`\n${COLORS.bold}  Diff Report${COLORS.reset}\n`);

  if (diff.added.length > 0) {
    console.log(`  ${COLORS.red}+${diff.added.length} new issues:${COLORS.reset}`);
    for (const f of diff.added) {
      console.log(`    ${COLORS.red}✗${COLORS.reset} ${COLORS.dim}${f.file}:${f.line}${COLORS.reset} ${f.msg}`);
    }
    console.log();
  }

  if (diff.fixed.length > 0) {
    console.log(`  ${COLORS.green}-${diff.fixed.length} fixed:${COLORS.reset}`);
    for (const f of diff.fixed) {
      console.log(`    ${COLORS.green}✓${COLORS.reset} ${COLORS.dim}${f.file}:${f.line}${COLORS.reset} ${f.msg}`);
    }
    console.log();
  }

  if (diff.added.length === 0 && diff.fixed.length === 0) {
    console.log(`  ${COLORS.dim}No changes${COLORS.reset}\n`);
  }

  const arrow = diff.score.delta > 0 ? `${COLORS.green}↑${diff.score.delta}${COLORS.reset}`
    : diff.score.delta < 0 ? `${COLORS.red}↓${Math.abs(diff.score.delta)}${COLORS.reset}`
    : `${COLORS.dim}→ no change${COLORS.reset}`;
  console.log(`  score: ${diff.score.old} → ${diff.score.new} (${arrow})`);
  console.log(`  grade: ${diff.grade.old} → ${diff.grade.new}`);
  console.log();
}

// skill-audit serve [--port 3847]
if (subcommand === 'serve') {
  const portStr = getArg('--port', '-p');
  const port = portStr ? parseInt(portStr, 10) : 3847;
  const server = createServer();
  server.listen(port, () => {
    console.log(`${COLORS.green}✓ skill-audit API server listening on http://localhost:${port}${COLORS.reset}`);
    console.log(`  POST /api/scan        Upload zip/tar.gz`);
    console.log(`  POST /api/scan-url    Clone & scan git URL`);
    console.log(`  GET  /api/badge       SVG badge`);
    console.log(`  GET  /api/health      Health check`);
  });
  // Keep process alive — don't fall through
} else

// skill-audit badge <path> [-o badge.svg]
if (subcommand === 'badge') {
  const badgeTarget = positional[1];
  if (!badgeTarget) {
    console.error(`${COLORS.red}✗ Usage: skill-audit badge <skill-dir> [-o badge.svg]${COLORS.reset}`);
    process.exit(2);
  }
  const badgeOutputPath = getArg('--output', '-o');
  const badgeTargetPath = resolve(badgeTarget);
  try {
    const report = await audit(badgeTargetPath);
    const { score, grade } = calculateScore(report.findings);
    const svg = generateBadge(score, grade);
    if (badgeOutputPath) {
      await writeFile(resolve(badgeOutputPath), svg, 'utf-8');
      console.log(`${COLORS.green}✓ Badge written to ${resolve(badgeOutputPath)}${COLORS.reset}`);
    } else {
      process.stdout.write(svg);
    }
    process.exit(0);
  } catch (err) {
    console.error(`${COLORS.red}✗ Error: ${err.message}${COLORS.reset}`);
    process.exit(2);
  }
} else {

// ─── Main scan command ───

const target = positional[0];

if (!target || flags.has('--help') || flags.has('-h')) {
  console.log(`
  skill-audit — Security scanner for AI agent skills

  Usage:
    skill-audit <path>                        Scan a skill directory
    skill-audit <path> --json                 Output JSON report
    skill-audit <path> --html -o report.html  Output HTML report
    skill-audit <path> --lang zh              Show fix suggestions in Chinese
    skill-audit <path> --save                 Save scan result to history
    skill-audit <path> --diff                 Compare with last saved scan
    skill-audit history <path>                View scan history
    skill-audit diff <old.json> <new.json>    Compare two report files
    skill-audit serve [--port 3847]           Start API server
    skill-audit badge <path> [-o badge.svg]   Generate SVG badge

  Options:
    --json             Output JSON report
    --html             Output HTML report
    --output, -o FILE  Output file path (used with --html or --json)
    --lang zh          Chinese fix suggestions (default: en)
    --save             Save scan result to .skill-audit/ history
    --diff             Compare with previous scan (auto-loads latest)
    -h, --help         Show this help

  Examples:
    skill-audit ./my-skill
    skill-audit ./my-skill --save --diff
    skill-audit ./my-skill --lang zh
    skill-audit ./my-skill --html -o report.html
    skill-audit history ./my-skill
    skill-audit diff old-scan.json new-scan.json
`);
  process.exit(0);
}

const jsonMode = flags.has('--json');
const htmlMode = flags.has('--html');
const saveMode = flags.has('--save');
const diffMode = flags.has('--diff');
const outputPath = getArg('--output', '-o');
let lang = 'en';
const langVal = getArg('--lang', null);
if (langVal) lang = langVal;

const targetPath = resolve(target);

try {
  const report = await audit(targetPath);
  const scoreResult = calculateScore(report.findings);

  // Load previous report for diff if requested
  let previousReport = null;
  if (diffMode) {
    previousReport = await getLatest(targetPath);
    if (!previousReport) {
      console.log(`\x1b[33m⚠ No previous scan found for diff. Run with --save first.\x1b[0m`);
    }
  }

  if (htmlMode) {
    const html = generateHtml(report, { lang });
    if (outputPath) {
      await writeFile(resolve(outputPath), html, 'utf-8');
      console.log(`\x1b[32m✓ HTML report written to ${resolve(outputPath)}\x1b[0m`);
    } else {
      process.stdout.write(html);
    }
  } else if (jsonMode) {
    const jsonData = { ...report, score: scoreResult };
    if (previousReport) {
      jsonData.diff = diffReports(previousReport, report);
    }
    const json = JSON.stringify(jsonData, null, 2);
    if (outputPath) {
      await writeFile(resolve(outputPath), json, 'utf-8');
      console.log(`\x1b[32m✓ JSON report written to ${resolve(outputPath)}\x1b[0m`);
    } else {
      console.log(json);
    }
  } else {
    formatReport(report, { lang, previousReport });
  }

  // Save after display (so the current scan becomes "latest" for next time)
  if (saveMode) {
    const saved = await saveReport(targetPath, { ...report, score: scoreResult });
    console.log(`\x1b[32m✓ Scan saved to ${saved.path}\x1b[0m`);
  }

  process.exit(report.summary.danger > 0 ? 1 : 0);
} catch (err) {
  console.error(`\x1b[31m✗ Error: ${err.message}\x1b[0m`);
  process.exit(2);
}
} // end else (main scan command)
