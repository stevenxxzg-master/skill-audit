import { calculateScore } from './scorer.js';
import { getSuggestion } from './fixer.js';
import { diffReports } from './diff.js';

const COLORS = {
  danger: '\x1b[31m',
  warn: '\x1b[33m',
  pass: '\x1b[32m',
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgRed: '\x1b[41m',
  white: '\x1b[37m',
};

const ICONS = {
  danger: '✗',
  warn: '⚠',
  pass: '✓',
};

function renderScoreBar(score) {
  const filled = Math.round(score / 5);
  const empty = 20 - filled;
  let color;
  if (score >= 70) color = COLORS.pass;
  else if (score >= 40) color = COLORS.warn;
  else color = COLORS.danger;
  return `${color}${'█'.repeat(filled)}${COLORS.dim}${'░'.repeat(empty)}${COLORS.reset}`;
}

function gradeColor(grade) {
  if (grade === 'A') return COLORS.pass;
  if (grade === 'B') return COLORS.pass;
  if (grade === 'C') return COLORS.warn;
  if (grade === 'D') return COLORS.warn;
  return COLORS.danger;
}

export function formatReport(report, options = {}) {
  const { findings, summary, target } = report;
  const lang = options.lang || 'en';
  const previousReport = options.previousReport || null;

  console.log();
  console.log(`${COLORS.bold}  skill-audit${COLORS.reset}  ${COLORS.dim}${target}${COLORS.reset}`);
  console.log(`${COLORS.dim}  Scanned ${summary.files} files${COLORS.reset}`);
  console.log();

  if (findings.length === 0) {
    console.log(`  ${COLORS.pass}${ICONS.pass} No issues found${COLORS.reset}`);
    console.log();
    const { score, grade } = calculateScore(findings);
    printScoreSection(score, grade);
    if (previousReport) printDiffSection(previousReport, report);
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
      // Fix suggestion
      const suggestion = getSuggestion(item.rule);
      console.log(`      ${COLORS.gray}💡 ${suggestion[lang]}${COLORS.reset}`);
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

  // Score section
  const { score, grade, breakdown } = calculateScore(findings);
  printScoreSection(score, grade, breakdown);

  // Diff section (if previous report available)
  if (previousReport) printDiffSection(previousReport, report);
}

function printScoreSection(score, grade, breakdown) {
  const gc = gradeColor(grade);
  console.log(`  ${COLORS.bold}Security Score${COLORS.reset}`);
  console.log(`  ${renderScoreBar(score)}  ${gc}${COLORS.bold}${score}/100${COLORS.reset}  ${gc}Grade: ${grade}${COLORS.reset}`);
  if (breakdown) {
    const parts = [];
    if (breakdown.danger.count > 0) parts.push(`${COLORS.danger}${breakdown.danger.count} danger (-${breakdown.danger.deduction})${COLORS.reset}`);
    if (breakdown.warn.count > 0) parts.push(`${COLORS.warn}${breakdown.warn.count} warn (-${breakdown.warn.deduction})${COLORS.reset}`);
    if (parts.length > 0) console.log(`  ${COLORS.dim}Deductions:${COLORS.reset} ${parts.join('  ')}`);
  }
  console.log();
}

function printDiffSection(oldReport, newReport) {
  const diff = diffReports(oldReport, newReport);
  const { added, fixed, score: scoreDiff, grade: gradeDiff } = diff;

  console.log(`  ${COLORS.bold}Changes vs previous scan${COLORS.reset}`);

  const parts = [];
  if (added.length > 0) {
    parts.push(`${COLORS.danger}+${added.length} new issues${COLORS.reset}`);
  }
  if (fixed.length > 0) {
    parts.push(`${COLORS.pass}-${fixed.length} fixed${COLORS.reset}`);
  }
  if (parts.length === 0) {
    parts.push(`${COLORS.dim}no changes${COLORS.reset}`);
  }
  console.log(`  ${parts.join('  ')}`);

  // Score change
  const arrow = scoreDiff.delta > 0 ? `${COLORS.pass}↑${scoreDiff.delta}${COLORS.reset}`
    : scoreDiff.delta < 0 ? `${COLORS.danger}↓${Math.abs(scoreDiff.delta)}${COLORS.reset}`
    : `${COLORS.dim}→ no change${COLORS.reset}`;
  console.log(`  score: ${scoreDiff.old} → ${scoreDiff.new} (${arrow})`);

  // Grade change
  if (gradeDiff.old !== gradeDiff.new) {
    const gc = gradeDiff.new < gradeDiff.old ? COLORS.pass : COLORS.danger;
    console.log(`  grade: ${gradeDiff.old} → ${gc}${gradeDiff.new}${COLORS.reset}`);
  }
  console.log();
}

export { diffReports } from './diff.js';
