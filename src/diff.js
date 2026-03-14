/**
 * @file diff.js
 * @description Report diff engine — compare two scan reports
 * @license MIT
 */

import { calculateScore } from './scorer.js';

const LINE_TOLERANCE = 3;

/**
 * Build a matching key for a finding.
 * Uses rule + file as the stable key, line is matched with tolerance.
 */
function findingKey(f) {
  return `${f.rule}::${f.file}`;
}

/**
 * Compare two audit reports and return a diff showing added, fixed, and kept findings.
 *
 * Matches findings by rule + file, with ±3 line tolerance for the same finding.
 *
 * @param {{findings: Array<{rule: string, severity: string, file: string, line: number}>}} oldReport - Previous scan report
 * @param {{findings: Array<{rule: string, severity: string, file: string, line: number}>}} newReport - Current scan report
 * @returns {{
 *   added: Array<Object>,
 *   fixed: Array<Object>,
 *   kept: Array<Object>,
 *   score: {old: number, new: number, delta: number},
 *   grade: {old: string, new: string},
 *   summary: {addedCount: number, fixedCount: number, keptCount: number}
 * }}
 */
export function diffReports(oldReport, newReport) {
  const oldFindings = oldReport.findings || [];
  const newFindings = newReport.findings || [];

  // Group old findings by key for efficient lookup
  const oldByKey = new Map();
  for (const f of oldFindings) {
    const key = findingKey(f);
    if (!oldByKey.has(key)) oldByKey.set(key, []);
    oldByKey.get(key).push({ ...f, _matched: false });
  }

  const added = [];
  const kept = [];

  for (const nf of newFindings) {
    const key = findingKey(nf);
    const candidates = oldByKey.get(key);
    if (!candidates) {
      added.push(nf);
      continue;
    }

    // Find best match within line tolerance
    let matched = false;
    for (const of_ of candidates) {
      if (!of_._matched && Math.abs(of_.line - nf.line) <= LINE_TOLERANCE) {
        of_._matched = true;
        kept.push(nf);
        matched = true;
        break;
      }
    }
    if (!matched) {
      added.push(nf);
    }
  }

  // Unmatched old findings are fixed
  const fixed = [];
  for (const candidates of oldByKey.values()) {
    for (const of_ of candidates) {
      if (!of_._matched) {
        fixed.push(of_);
      }
    }
  }
  // Clean up internal _matched flag
  for (const f of fixed) delete f._matched;

  const oldScore = calculateScore(oldFindings);
  const newScore = calculateScore(newFindings);

  return {
    added,
    fixed,
    kept,
    score: {
      old: oldScore.score,
      new: newScore.score,
      delta: newScore.score - oldScore.score,
    },
    grade: {
      old: oldScore.grade,
      new: newScore.grade,
    },
    summary: {
      addedCount: added.length,
      fixedCount: fixed.length,
      keptCount: kept.length,
    },
  };
}
