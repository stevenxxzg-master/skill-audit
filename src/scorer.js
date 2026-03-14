/**
 * @file scorer.js
 * @description Security score calculator — converts findings to score/grade
 * @license MIT
 */

const DEDUCTIONS = { danger: 15, warn: 5 };

function getGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

/**
 * Calculate a security score (0-100) and grade (A-F) from scan findings.
 *
 * Scoring: starts at 100, deducts 15 per danger finding and 5 per warn finding.
 * Minimum score is 0.
 *
 * @param {Array<{severity: 'danger'|'warn'}>} findings - Array of scan findings
 * @returns {{score: number, grade: 'A'|'B'|'C'|'D'|'F', breakdown: {danger: {count: number, deduction: number}, warn: {count: number, deduction: number}, totalDeduction: number}}}
 */
export function calculateScore(findings) {
  let dangerCount = 0;
  let warnCount = 0;

  for (const f of findings) {
    if (f.severity === 'danger') dangerCount++;
    else if (f.severity === 'warn') warnCount++;
  }

  const dangerDeduction = dangerCount * DEDUCTIONS.danger;
  const warnDeduction = warnCount * DEDUCTIONS.warn;
  const totalDeduction = dangerDeduction + warnDeduction;
  const score = Math.max(0, 100 - totalDeduction);
  const grade = getGrade(score);

  return {
    score,
    grade,
    breakdown: {
      danger: { count: dangerCount, deduction: dangerDeduction },
      warn: { count: warnCount, deduction: warnDeduction },
      totalDeduction,
    },
  };
}
